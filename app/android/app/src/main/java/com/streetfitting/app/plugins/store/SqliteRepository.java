package com.streetfitting.app.plugins.store;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** One monitor serializes all domain transactions, file promotion and post-commit events. */
public final class SqliteRepository implements NativeRepository {
    public interface ChangeListener { void changed(JSObject change); }
    private final Context context;
    private final StoreDatabase helper;
    private final SQLiteDatabase db;
    private final File root;
    private final File draftRoot;
    private final Set<String> claims = new HashSet<>();
    private final Map<Long,Integer> pins = new HashMap<>();
    private final List<ChangeListener> listeners = new ArrayList<>();
    private Runnable sessionStopper;
    private final List<File> created = new ArrayList<>();
    private final Set<String> changedEntities = new HashSet<>();
    private final Set<String> changedIds = new HashSet<>();

    public SqliteRepository(Context context) { this(context, "street-fitting.db", "store"); }
    SqliteRepository(Context context, String databaseName, String directoryName) {
        this.context = context.getApplicationContext();
        try {
            root = new File(context.getFilesDir(), directoryName).getCanonicalFile();
            draftRoot = new File(context.getCacheDir(), directoryName.equals("store") ? "result-drafts" : directoryName+"-drafts").getCanonicalFile();
        } catch(java.io.IOException error) {throw error("io_error");}
        if (!root.isDirectory() && !root.mkdirs()) throw error("io_error");
        helper = new StoreDatabase(context, databaseName);
        db = helper.getWritableDatabase();
        db.beginTransaction();
        try {
            db.execSQL("INSERT OR IGNORE INTO Garbage(file) SELECT file FROM OwnedFile WHERE ownerType IN ('ResultDraft','Candidate')");
            db.delete("OwnedFile", "ownerType IN ('ResultDraft','Candidate')", null);
            db.delete("ResultDraft", null, null);
            db.execSQL("DELETE FROM OwnedFile WHERE ownerType='SelfVersion' AND ownerId NOT IN (SELECT CAST(updatedAt AS TEXT) FROM SelfPhoto)");
            db.execSQL("DELETE FROM SelfVersion WHERE updatedAt NOT IN (SELECT updatedAt FROM SelfPhoto)");
            db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        drainGarbage();
        collectGarbage(root);
        collectGarbage(draftRoot);
    }
    public synchronized void addChangeListener(ChangeListener listener) { listeners.add(listener); }
    public synchronized void removeChangeListener(ChangeListener listener) { listeners.remove(listener); }
    @Override public synchronized void setSessionStopper(Runnable stopper) { sessionStopper = stopper; }
    public synchronized void close() { helper.close(); }
    static IllegalArgumentException error(String code) {
        switch(code) {
            case "invalid_input": code="constraint_violation"; break;
            case "not_found": code="invalid_reference"; break;
            case "job_unavailable": code="job_not_claimed"; break;
            default: break;
        }
        return new IllegalArgumentException(code);
    }
    private static String uid() { return UUID.randomUUID().toString(); }
    private static JSObject object(JSONObject value) {
        try { return new JSObject(value.toString()); } catch (Exception e) { throw error("invalid_input"); }
    }
    private static JSObject obj(Object... pairs) {
        JSObject result = new JSObject();
        for (int i=0;i<pairs.length;i+=2) result.put((String)pairs[i], pairs[i+1] == null ? JSONObject.NULL : pairs[i+1]);
        return result;
    }
    private static String string(JSONObject input, String key) {
        Object value = input.opt(key);
        if (!(value instanceof String)) throw error("invalid_input");
        return (String)value;
    }
    private static String id(JSONObject input, String key) {
        String value = string(input,key);
        if (value.isEmpty() || value.length()>128) throw error("invalid_input");
        return value;
    }
    private static long time(JSONObject input, String key) {
        Object value=input.opt(key);
        if (!(value instanceof Number)) throw error("invalid_input");
        double n=((Number)value).doubleValue();
        if (!Double.isFinite(n)||n<0||n>9007199254740991d||n!=Math.floor(n)) throw error("invalid_input");
        return ((Number)value).longValue();
    }
    private static double number(JSONObject input,String key,double min,double max) {
        Object value=input.opt(key);
        if (!(value instanceof Number)) throw error("invalid_input");
        double n=((Number)value).doubleValue();
        if (!Double.isFinite(n)||n<min||n>max) throw error("invalid_input");
        return n;
    }
    private static JSObject nested(JSONObject input,String key) {
        JSONObject value=input.optJSONObject(key);
        if(value==null) throw error("invalid_input");
        return object(value);
    }
    private static String text(JSONObject input,String key,int max) {
        String value=string(input,key).trim();
        if(value.isEmpty()||value.length()>max) throw error("invalid_input");
        return value;
    }
    private static String choice(JSONObject input,String key,String... allowed) {
        String value=string(input,key);
        for(String x:allowed) if(x.equals(value)) return value;
        throw error("invalid_input");
    }
    private static void location(ContentValues values,JSONObject input) {
        values.put("lat",number(input,"lat",-90,90));
        values.put("lng",number(input,"lng",-180,180));
        values.put("accuracyM",number(input,"accuracyM",0,Double.MAX_VALUE));
    }
    private static ContentValues values(Object... pairs) {
        ContentValues values=new ContentValues();
        for(int i=0;i<pairs.length;i+=2) {
            String key=(String)pairs[i]; Object value=pairs[i+1];
            if(value==null||value==JSONObject.NULL) values.putNull(key);
            else if(value instanceof byte[]) values.put(key,(byte[])value);
            else if(value instanceof Boolean) values.put(key,(Boolean)value);
            else if(value instanceof Integer) values.put(key,(Integer)value);
            else if(value instanceof Long) values.put(key,(Long)value);
            else if(value instanceof Number) values.put(key,((Number)value).doubleValue());
            else values.put(key,value.toString());
        }
        return values;
    }
    private interface Mutation { JSObject run() throws Exception; }
    private JSObject transaction(Mutation mutation) {
        created.clear(); changedEntities.clear(); changedIds.clear();
        db.beginTransaction();
        JSObject result;
        boolean committed=false;
        try {
            result=mutation.run();
            db.setTransactionSuccessful(); committed=true;
        } catch (IllegalArgumentException e) { throw e;
        } catch (Exception e) { throw error(e instanceof android.database.sqlite.SQLiteConstraintException ? "constraint_violation" : e instanceof android.database.sqlite.SQLiteFullException ? "storage_full" : "io_error");
        } finally {
            db.endTransaction();
            if(!committed) for(File file:created) file.delete();
            created.clear();
        }
        drainGarbage();
        collectGarbage(root);
        collectGarbage(draftRoot);
        if(!changedEntities.isEmpty()) {
            JSObject event=obj("entities",new JSONArray(changedEntities),"ids",new JSONArray(changedIds));
            for(ChangeListener listener:new ArrayList<>(listeners)) {
                try { listener.changed(event); } catch(RuntimeException ignored) { /* Committed state cannot roll back for a UI listener. */ }
            }
        }
        return result;
    }
    private void changed(String entity,String id) { changedEntities.add(entity); changedIds.add(id); }
    private void insert(String table,ContentValues values,String id) { db.insertOrThrow(table,null,values); changed(table,id); }
    private void update(String table,ContentValues values,String key,String id) { db.update(table,values,key+"=?",new String[]{id}); changed(table,id); }
    private static final Set<String> ENTITIES=Set.of("Trip","Shop","Photo","TrailPoint","PhotoEmbedding","Piece","Result","QueueJob");
    private JSObject row(String table,String key,String id) {
        try(Cursor c=db.query(table,null,key+"=?",new String[]{id},null,null,null)) { return c.moveToFirst()?decode(table,c):null; }
    }
    private JSObject required(String table,String id) { JSObject value=row(table,"id",id); if(value==null) throw error("not_found"); return value; }
    private JSObject decode(String table,Cursor c) {
        JSObject out=new JSObject();
        for(int i=0;i<c.getColumnCount();i++) {
            String key=c.getColumnName(i);
            switch(c.getType(i)) {
                case Cursor.FIELD_TYPE_NULL: out.put(key,JSONObject.NULL); break;
                case Cursor.FIELD_TYPE_INTEGER: out.put(key,c.getLong(i)); break;
                case Cursor.FIELD_TYPE_FLOAT: out.put(key,c.getDouble(i)); break;
                case Cursor.FIELD_TYPE_BLOB:
                    JSONArray vector=new JSONArray(); ByteBuffer buffer=ByteBuffer.wrap(c.getBlob(i)).order(ByteOrder.LITTLE_ENDIAN);
                    while(buffer.hasRemaining()) vector.put((Object)(double)buffer.getFloat()); out.put(key,vector); break;
                default: out.put(key,c.getString(i));
            }
        }
        if(table.equals("Shop")||table.equals("Photo")) {
            out.put(table.equals("Shop")?"spot":"location",obj("lat",out.remove("lat"),"lng",out.remove("lng"),"accuracyM",out.remove("accuracyM")));
        }
        if(table.equals("Piece")) {
            Object lat=out.remove("walkLat"),lng=out.remove("walkLng");
            out.put("walkTo",lat==JSONObject.NULL?JSONObject.NULL:obj("lat",lat,"lng",lng));
        }
        if(table.equals("Result")||table.equals("ResultDraft")) {
            try {
                out.put("companionPieceIds",new JSONArray(out.getString("companionPieceIds")));
                out.put("targetSnapshot",new JSONObject(out.getString("targetSnapshot")));
                out.put("companionSnapshots",new JSONArray(out.getString("companionSnapshots")));
                if(table.equals("Result")) out.put("faceless",out.getLong("faceless")==1);
            } catch(Exception e) { throw error("io_error"); }
        }
        out.remove("singleton");
        return out;
    }
    @Override public synchronized JSObject get(JSObject input) {
        String entity=choice(input,"entity",ENTITIES.toArray(new String[0])); String key=id(input,"id");
        if(entity.equals("TrailPoint")) {
            int split=key.lastIndexOf(':'); if(split<1) throw error("invalid_input");
            try(Cursor c=db.query(entity,null,"tripId=? AND t=?",new String[]{key.substring(0,split),key.substring(split+1)},null,null,null)) { return c.moveToFirst()?decode(entity,c):null; }
        }
        return row(entity,entity.equals("PhotoEmbedding")?"photoId":"id",key);
    }
    @Override public synchronized JSObject list(JSObject input) {
        String entity=choice(input,"entity",ENTITIES.toArray(new String[0]));
        int limit=input.has("limit")?(int)time(input,"limit"):50;
        if(limit<1||limit>200) throw error("invalid_input");
        StringBuilder where=new StringBuilder("1=1"); List<String> args=new ArrayList<>();
        for(String filter:new String[]{"tripId","shopId","origin"}) if(input.has(filter)) {
            boolean allowed=filter.equals("tripId")?Set.of("Shop","Photo","TrailPoint","Piece").contains(entity):filter.equals("shopId")?Set.of("Photo","Piece").contains(entity):entity.equals("Piece");
            if(!allowed) throw error("invalid_argument");
            where.append(" AND ").append(filter).append("=?"); args.add(id(input,filter));
        }
        String sort=entity.equals("Trip")?"startedAt":entity.equals("Photo")?"takenAt":Set.of("Piece","Result").contains(entity)?"createdAt":entity.equals("Shop")?"n":entity.equals("TrailPoint")?"t":entity.equals("QueueJob")?"nextAt":"photoId";
        String key=entity.equals("TrailPoint")?"tripId":entity.equals("PhotoEmbedding")?"photoId":"id";
        boolean desc=Set.of("Trip","Photo","Piece","Result").contains(entity);
        String binding=new JSONArray().put(entity).put(input.optString("tripId","")).put(input.optString("shopId","")).put(input.optString("origin","")).toString();
        if(input.has("cursor")&&!input.isNull("cursor")) {
            try {
                JSONArray cursor=new JSONArray(new String(Base64.decode(string(input,"cursor"),Base64.URL_SAFE|Base64.NO_WRAP),StandardCharsets.UTF_8));
                if(!binding.equals(cursor.getString(0))) throw error("invalid_input");
                if(entity.equals("Shop")) {
                    where.append(" AND (tripId>? OR (tripId=? AND (n>? OR (n=? AND id>?))))");
                    args.add(cursor.getString(3));args.add(cursor.getString(3));args.add(cursor.getString(1));args.add(cursor.getString(1));args.add(cursor.getString(2));
                } else {
                    where.append(" AND (").append(sort).append(desc?"<?":" >?").append(" OR (").append(sort).append("=? AND ").append(key).append(">?))");
                    args.add(cursor.getString(1));args.add(cursor.getString(1));args.add(cursor.getString(2));
                }
            } catch(Exception e) { throw error("invalid_input"); }
        }
        JSONArray items=new JSONArray(); String cursor=null;
        String order=(entity.equals("Shop")?"tripId ASC,":"")+sort+(desc?" DESC,":" ASC,")+key+" ASC";
        try(Cursor c=db.query(entity,null,where.toString(),args.toArray(new String[0]),null,null,order,String.valueOf(limit+1))) {
            while(c.moveToNext()) {
                if(items.length()==limit) break;
                items.put(decode(entity,c));
                if(items.length()==limit) {
                    JSONArray point=new JSONArray().put(binding).put(c.getString(c.getColumnIndexOrThrow(sort))).put(c.getString(c.getColumnIndexOrThrow(key)));
                    if(entity.equals("Shop")) point.put(c.getString(c.getColumnIndexOrThrow("tripId")));
                    cursor=Base64.encodeToString(point.toString().getBytes(StandardCharsets.UTF_8),Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING);
                }
            }
            if(c.getCount()<=limit) cursor=null;
        }
        return obj("items",items,"nextCursor",cursor);
    }
    private File owned(String ref) {
        try {
            Uri uri=Uri.parse(ref);
            if(!"file".equals(uri.getScheme())||uri.getPath()==null) throw error("file_not_owned");
            File file=new File(uri.getPath()).getCanonicalFile();
            String path=file.getPath();
            if(!path.startsWith(context.getFilesDir().getCanonicalPath()+"/")&&!path.startsWith(context.getCacheDir().getCanonicalPath()+"/")) throw error("file_not_owned");
            if(!file.isFile()) throw error("not_found");
            return file;
        } catch(java.io.IOException e) { throw error("io_error"); }
    }
    private String promote(File source,String owner,String ownerId,String name) throws Exception {
        File folder=owner.equals("ResultDraft")?new File(draftRoot,ownerId):new File(root,owner+"/"+Base64.encodeToString(ownerId.getBytes(StandardCharsets.UTF_8),Base64.URL_SAFE|Base64.NO_WRAP|Base64.NO_PADDING));
        if(!folder.isDirectory()&&!folder.mkdirs()) throw error("io_error");
        File temp=new File(folder,uid()+".tmp"),dest=new File(folder,name+"-"+uid());
        created.add(temp); created.add(dest);
        try(FileInputStream in=new FileInputStream(source);FileOutputStream out=new FileOutputStream(temp)) {
            byte[] buffer=new byte[16384]; int n; while((n=in.read(buffer))!=-1) out.write(buffer,0,n); out.getFD().sync();
        }
        if(!temp.renameTo(dest)) throw error("io_error");
        String ref=Uri.fromFile(dest).toString();
        db.insertOrThrow("OwnedFile",null,values("file",ref,"ownerType",owner,"ownerId",ownerId));
        return ref;
    }
    private void retire(String file) { db.insertWithOnConflict("Garbage",null,values("file",file),SQLiteDatabase.CONFLICT_IGNORE); }
    private void transferSource(File source) {
        String ref=Uri.fromFile(source).toString();
        try(Cursor cursor=db.rawQuery("SELECT 1 FROM OwnedFile WHERE file=?",new String[]{ref})) {
            if(!cursor.moveToFirst()) retire(ref);
        }
    }
    private void unown(String type,String id) {
        try(Cursor cursor=db.query("OwnedFile",new String[]{"file"},"ownerType=? AND ownerId=?",new String[]{type,id},null,null,null)) {while(cursor.moveToNext()) retire(cursor.getString(0));}
        db.delete("OwnedFile","ownerType=? AND ownerId=?",new String[]{type,id});
    }
    private void drainGarbage() {
        db.execSQL("DELETE FROM Garbage WHERE file IN (SELECT file FROM OwnedFile)");
        List<String> removed=new ArrayList<>();
        try(Cursor cursor=db.query("Garbage",null,null,null,null,null,null)) {
            while(cursor.moveToNext()) {
                String ref=cursor.getString(0);
                try {File file=owned(ref);if(file.delete()) removed.add(ref);}
                catch(IllegalArgumentException error) {if("invalid_reference".equals(error.getMessage())) removed.add(ref);}
            }
        }
        for(String file:removed) db.delete("Garbage","file=?",new String[]{file});
    }
    private void collectGarbage(File directory) {
        File[] files=directory.listFiles(); if(files==null) return;
        for(File file:files) {
            if(file.isDirectory()) { collectGarbage(file); file.delete(); }
            else try(Cursor c=db.rawQuery("SELECT 1 FROM OwnedFile WHERE file=?",new String[]{Uri.fromFile(file).toString()})) { if(!c.moveToFirst()) file.delete(); }
        }
    }
    @Override public synchronized JSObject startSession(JSObject input) { return transaction(()->{
        JSObject fix=nested(input,"fix"); long t=time(fix,"t"); ContentValues location=new ContentValues(); location(location,fix);
        try(Cursor c=db.query("Trip",null,"status='recording'",null,null,null,null)) {
            if(c.moveToFirst()) { JSObject trip=decode("Trip",c); return obj("trip",trip,"shop",latestShop(trip.getString("id"))); }
        }
        String trip=uid(); insert("Trip",values("id",trip,"startedAt",t,"endedAt",null,"status","recording"),trip);
        JSObject shop=createShop(trip,fix,1); appendTrailInternal(trip,fix);
        return obj("trip",required("Trip",trip),"shop",shop);
    }); }
    private JSObject latestShop(String trip) {
        try(Cursor c=db.query("Shop",null,"tripId=?",new String[]{trip},null,null,"n DESC","1")) { if(!c.moveToFirst()) throw error("not_found"); return decode("Shop",c); }
    }
    private JSObject createShop(String trip,JSObject fix,int n) {
        String id=uid(); ContentValues values=values("id",id,"tripId",trip,"n",n,"startedAt",time(fix,"t"),"storefrontPhotoId",null,"description",null,"descriptionState","none","note",null); location(values,fix); insert("Shop",values,id); return required("Shop",id);
    }
    @Override public synchronized JSObject newShop(JSObject input) { return transaction(()->{
        String trip=id(input,"tripId"); JSObject fix=nested(input,"fix"),current=required("Trip",trip);
        if(!"recording".equals(current.getString("status"))||time(fix,"t")<current.getLong("startedAt")) throw error("invalid_input");
        return createShop(trip,fix,latestShop(trip).getInteger("n")+1);
    }); }
    private void appendTrailInternal(String trip,JSObject fix) {
        JSObject current=required("Trip",trip);
        long t=time(fix,"t"); if(!"recording".equals(current.getString("status"))||t<current.optLong("startedAt")) throw error("invalid_input");
        ContentValues values=values("tripId",trip,"t",t);location(values,fix);
        db.insertWithOnConflict("TrailPoint",null,values,SQLiteDatabase.CONFLICT_REPLACE); changed("TrailPoint",trip+":"+t);
    }
    @Override public synchronized JSObject appendTrail(JSObject input) { return transaction(()->{String trip=id(input,"tripId");JSObject fix=nested(input,"fix");appendTrailInternal(trip,fix);return obj("tripId",trip,"t",time(fix,"t"),"lat",fix.getDouble("lat"),"lng",fix.getDouble("lng"),"accuracyM",fix.getDouble("accuracyM"));}); }
    @Override public synchronized JSObject stopSession(JSObject input) { return transaction(()->{
        String trip=id(input,"tripId");JSObject current=required("Trip",trip);long t=time(input,"endedAt");
        if(t<current.getLong("startedAt")) throw error("invalid_input");
        if("recording".equals(current.getString("status"))) update("Trip",values("status","ended","endedAt",t),"id",trip);
        db.delete("TrailPoint","tripId=?",new String[]{trip});changed("TrailPoint",trip);return required("Trip",trip);
    }); }
    @Override public synchronized JSObject commitPhoto(JSObject input) { return transaction(()->commitPhotoInternal(input,false)); }
    @Override public synchronized JSObject commitStorefront(JSObject input) { return transaction(()->commitPhotoInternal(input,true)); }
    private JSObject commitPhotoInternal(JSObject input,boolean storefrontPreview) throws Exception {
        JSObject photo=nested(input,"photo");String id=id(photo,"id"),trip=id(photo,"tripId"),shop=id(photo,"shopId");
        String kind=choice(photo,"kind","item","storefront");long t=time(photo,"takenAt");
        if(storefrontPreview&&!"storefront".equals(kind)) throw error("invalid_input");
        JSObject existing=row("Photo","id",id);
        if(existing!=null) {
            if(!trip.equals(existing.getString("tripId"))||!shop.equals(existing.getString("shopId"))||!kind.equals(existing.getString("kind"))) throw error("invalid_input");
            return existing;
        }
        if(!trip.equals(required("Shop",shop).getString("tripId"))) throw error("invalid_input");
        JSObject currentTrip=required("Trip",trip);
        if((!storefrontPreview&&!"recording".equals(currentTrip.getString("status")))||t<currentTrip.optLong("startedAt")) throw error("invalid_input");
        int w=(int)time(photo,"w"),h=(int)time(photo,"h");if(w<=0||h<=0) throw error("invalid_input");
        File source=owned(string(photo,"file")); validateImage(source,w,h);
        String file=promote(source,"Photo",id,"original");
        ContentValues values=values("id",id,"tripId",trip,"shopId",shop,"kind",kind,"takenAt",t,"file",file,"w",w,"h",h,"indexState","pending");location(values,nested(photo,"location"));insert("Photo",values,id);
        if(kind.equals("storefront")) {
            JSObject old=required("Shop",shop);if(!old.isNull("storefrontPhotoId")) cancelJobs("describe_storefront",old.getString("storefrontPhotoId"));
            update("Shop",values("storefrontPhotoId",id,"description",null,"descriptionState","pending"),"id",shop);enqueueInternal("describe_storefront",id,false);
        }
        transferSource(source);
        return required("Photo",id);
    }
    private static void validateImage(File file,int w,int h) {
        BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeFile(file.getPath(),options);
        if(options.outWidth!=w||options.outHeight!=h) throw error("invalid_input");
    }
    @Override public synchronized JSObject commitEmbedding(JSObject input) { return transaction(()->{
        JSObject embedding=nested(input,"embedding");String photo=id(embedding,"photoId");required("Photo",photo);
        if(!"pe-core-t16-image".equals(string(embedding,"model"))||time(embedding,"dim")!=512) throw error("invalid_input");
        JSONArray vector=embedding.optJSONArray("vector");if(vector==null||vector.length()!=512) throw error("invalid_input");
        ByteBuffer buffer=ByteBuffer.allocate(2048).order(ByteOrder.LITTLE_ENDIAN);double norm=0;
        for(int i=0;i<512;i++) { Object value=vector.opt(i);if(!(value instanceof Number)) throw error("invalid_input");double n=((Number)value).doubleValue();if(!Double.isFinite(n)) throw error("invalid_input");float f=(float)n;buffer.putFloat(f);norm+=(double)f*f; }
        if(Math.abs(Math.sqrt(norm)-1)>1e-4) throw error("invalid_input");
        db.insertWithOnConflict("PhotoEmbedding",null,values("photoId",photo,"model","pe-core-t16-image","dim",512,"vector",buffer.array()),SQLiteDatabase.CONFLICT_REPLACE);
        changed("PhotoEmbedding",photo);update("Photo",values("indexState","done"),"id",photo);return row("PhotoEmbedding","photoId",photo);
    }); }
    @Override public synchronized JSObject markIndexFailed(JSObject input) { return transaction(()->{String photo=id(input,"photoId");required("Photo",photo);db.delete("PhotoEmbedding","photoId=?",new String[]{photo});changed("PhotoEmbedding",photo);update("Photo",values("indexState","failed"),"id",photo);return required("Photo",photo);}); }
    @Override public synchronized JSObject getSelfPhoto() { return row("SelfPhoto","singleton","1"); }
    @Override public synchronized JSObject replaceSelfPhoto(JSObject input) { return transaction(()->{
        JSObject self=nested(input,"selfPhoto");long t=time(self,"updatedAt");JSObject old=getSelfPhoto();
        if(old!=null&&t<=old.getLong("updatedAt")) throw error("invalid_input");
        ContentValues values=values("singleton",1,"updatedAt",t);
        BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;
        BitmapFactory.decodeFile(owned(string(self,"file")).getPath(),dimensions);
        if(dimensions.outWidth<1||dimensions.outHeight<1) throw error("invalid_input");
        validateImage(owned(string(self,"headMask")),dimensions.outWidth,dimensions.outHeight);
        BitmapFactory.Options maskedDimensions=new BitmapFactory.Options();maskedDimensions.inJustDecodeBounds=true;
        BitmapFactory.decodeFile(owned(string(self,"maskedFile")).getPath(),maskedDimensions);
        if(maskedDimensions.outWidth<1||maskedDimensions.outHeight<1) throw error("invalid_input");
        for(String name:new String[]{"file","headMask","maskedFile"}) values.put(name,promote(owned(string(self,name)),"SelfVersion",String.valueOf(t),name));
        db.insertWithOnConflict("SelfPhoto",null,values,SQLiteDatabase.CONFLICT_REPLACE);values.remove("singleton");db.insertOrThrow("SelfVersion",null,values);
        if(old!=null&&!pins.containsKey(old.getLong("updatedAt"))) releaseVersion(old.getLong("updatedAt"));
        changed("SelfPhoto",String.valueOf(t));return getSelfPhoto();
    }); }
    @Override public synchronized JSObject retainSelf(JSObject input) {
        long t=time(input,"updatedAt");JSObject self=row("SelfVersion","updatedAt",String.valueOf(t));if(self==null) throw error("not_found");pins.put(t,pins.getOrDefault(t,0)+1);return self;
    }
    private void releaseVersion(long t) { db.delete("SelfVersion","updatedAt=?",new String[]{String.valueOf(t)});unown("SelfVersion",String.valueOf(t)); }
    @Override public synchronized JSObject releaseSelf(JSObject input) { return transaction(()->{
        long t=time(input,"updatedAt");int count=pins.getOrDefault(t,0);if(count>1) pins.put(t,count-1);else {pins.remove(t);JSObject current=getSelfPhoto();if(current==null||current.getLong("updatedAt")!=t) releaseVersion(t);}return new JSObject();
    }); }
    @Override public synchronized JSObject registerAsset(JSObject input) { return transaction(()->{
        JSObject asset=nested(input,"asset");String id=id(asset,"id"),purpose=choice(input,"purpose","self","wardrobe");int w=(int)time(asset,"w"),h=(int)time(asset,"h");if(w<=0||h<=0) throw error("invalid_input");File file=owned(string(asset,"file"));validateImage(file,w,h);
        if(row("Asset","id",id)!=null) throw error("invalid_input");
        String stored=promote(file,"Asset",id,"original");db.insertOrThrow("Asset",null,values("id",id,"file",stored,"w",w,"h",h,"purpose",purpose));transferSource(file);return obj("id",id,"file",stored,"w",w,"h",h);
    }); }
    @Override public synchronized JSObject getAsset(JSObject input) {
        JSObject asset=row("Asset","id",id(input,"id"));if(asset!=null) asset.remove("purpose");return asset;
    }
    @Override public synchronized JSObject discardAsset(JSObject input) {return transaction(()->{
        String id=id(input,"assetId");purgeCandidates(id);db.delete("Asset","id=?",new String[]{id});unown("Asset",id);return new JSObject();
    });}
    @Override public synchronized JSObject adoptCandidate(JSObject input) {return transaction(()->{
        String owner=id(input,"ownerId"),ref=string(input,"file");File file=owned(ref);
        String prefix=new File(context.getCacheDir(),"relay/candidate-mask").getCanonicalPath()+"/";
        if(!file.getCanonicalPath().startsWith(prefix)) throw error("file_not_owned");
        JSObject source=row("Photo","id",owner);
        if(source==null) {source=row("Asset","id",owner);if(source==null||!"wardrobe".equals(source.getString("purpose"))) throw error("invalid_reference");}
        validateImage(file,source.getInteger("w"),source.getInteger("h"));
        db.insertOrThrow("OwnedFile",null,values("file",Uri.fromFile(file).toString(),"ownerType","Candidate","ownerId",owner));return new JSObject();
    });}
    private void purgeCandidates(String owner) throws Exception {
        unown("Candidate",owner);
        File base=new File(context.getCacheDir(),"candidates").getCanonicalFile(),directory=new File(base,owner).getCanonicalFile();
        if(!directory.getPath().startsWith(base.getPath()+"/")) return;
        retireTree(directory);
    }
    private void retireTree(File directory) {
        File[] children=directory.listFiles();if(children==null) return;
        for(File file:children) {if(file.isDirectory()) retireTree(file);else {owned(Uri.fromFile(file).toString());retire(Uri.fromFile(file).toString());}}
    }
    @Override public synchronized JSObject saveCandidate(JSObject input) { return transaction(()->{
        JSObject candidate=nested(input,"candidate");String photoId=id(candidate,"photoId"),source=choice(candidate,"source","sam","edgetam");
        String origin=choice(input,"origin","shop","wardrobe"),labelMode=choice(input,"labelMode","concept","describe");
        if(origin.equals("wardrobe")&&!labelMode.equals("describe")) throw error("invalid_input");
        number(candidate,"score",0,1);
        JSObject photo=origin.equals("shop")?required("Photo",photoId):row("Asset","id",photoId);
        if(photo==null||origin.equals("wardrobe")&&!"wardrobe".equals(photo.getString("purpose"))) throw error("invalid_input");
        int w=photo.getInteger("w"),h=photo.getInteger("h");
        File maskFile=owned(string(candidate,"mask"));Bitmap mask=BitmapFactory.decodeFile(maskFile.getPath());
        if(mask==null) throw error("invalid_input");
        Bitmap original=null,cutout=null;
        File temp=null;
        try {
            if(mask.getWidth()!=w||mask.getHeight()!=h) throw error("invalid_input");
            byte[] binary=new byte[w*h];int[] pixels=new int[w*h];mask.getPixels(pixels,0,w,0,0,w,h);
            int left=w,top=h,right=-1,bottom=-1;
            for(int y=0;y<h;y++) for(int x=0;x<w;x++) {
                int color=pixels[y*w+x],r=(color>>16)&255,g=(color>>8)&255,b=color&255;
                if((r!=0&&r!=255)||r!=g||g!=b||((color>>>24)&255)!=255) throw error("invalid_input");
                binary[y*w+x]=(byte)r;
                if(r==255) {left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
            }
            if(right<0) throw error("invalid_input");
            JSONArray bbox=candidate.optJSONArray("bbox");int[] bounds={left,top,right-left+1,bottom-top+1};
            if(bbox==null||bbox.length()!=4) throw error("invalid_input");
            for(int i=0;i<4;i++) if(!(bbox.opt(i) instanceof Number)||bbox.optDouble(i)!=bounds[i]) throw error("invalid_input");
            MessageDigest digest=MessageDigest.getInstance("SHA-256");
            digest.update(photoId.getBytes(StandardCharsets.UTF_8));digest.update(source.getBytes(StandardCharsets.UTF_8));digest.update(binary);
            StringBuilder hash=new StringBuilder();for(byte b:digest.digest()) hash.append(String.format(java.util.Locale.ROOT,"%02x",b&255));
            String pieceId="piece:"+hash;
            JSObject existing=row("Piece","id",pieceId);if(existing!=null) return existing;
            original=BitmapFactory.decodeFile(owned(string(photo,"file")).getPath());if(original==null||original.getWidth()!=w||original.getHeight()!=h) throw error("invalid_input");
            int cw=bounds[2],ch=bounds[3];int[] cropped=new int[cw*ch];original.getPixels(cropped,0,cw,left,top,cw,ch);
            for(int y=0;y<ch;y++) for(int x=0;x<cw;x++) if(binary[(y+top)*w+x+left]==0) cropped[y*cw+x]=0;
            cutout=Bitmap.createBitmap(cropped,cw,ch,Bitmap.Config.ARGB_8888);
            temp=File.createTempFile("cutout-", ".png",context.getCacheDir());
            try(FileOutputStream out=new FileOutputStream(temp)) { if(!cutout.compress(Bitmap.CompressFormat.PNG,100,out)) throw error("io_error");out.getFD().sync(); }
            String file=promote(temp,"Piece",pieceId,"cutout.png");
            String label=labelMode.equals("concept")?text(candidate,"label",120):"Picked item";
            ContentValues values=values("id",pieceId,"origin",origin,"label",label,"category","unknown","cutoutFile",file,"createdAt",System.currentTimeMillis(),"photoId",null,"shopId",null,"tripId",null,"walkLat",null,"walkLng",null);
            if(origin.equals("shop")) {
                JSObject location=nested(photo,"location");
                values.put("photoId",photoId);values.put("shopId",photo.getString("shopId"));values.put("tripId",photo.getString("tripId"));values.put("walkLat",location.getDouble("lat"));values.put("walkLng",location.getDouble("lng"));
            }
            insert("Piece",values,pieceId);
            if(labelMode.equals("describe")) enqueueInternal("label_piece",pieceId,false);
            return required("Piece",pieceId);
        } finally {mask.recycle();if(original!=null) original.recycle();if(cutout!=null) cutout.recycle();if(temp!=null) temp.delete();}
    }); }
    @Override public synchronized JSObject updateShop(JSObject input) { return transaction(()->{
        String id=id(input,"id");required("Shop",id);
        if(!input.has("note")) throw error("invalid_input");String note=input.isNull("note")?null:string(input,"note").trim();
        if(note!=null&&note.isEmpty()) note=null;if(note!=null&&note.length()>280) throw error("invalid_input");
        update("Shop",values("note",note),"id",id);return required("Shop",id);
    }); }
    @Override public synchronized JSObject updatePiece(JSObject input) { return transaction(()->{
        String id=id(input,"id");required("Piece",id);String label=text(input,"label",120),category=text(input,"category",64);
        update("Piece",values("label",label,"category",category),"id",id);cancelJobs("label_piece",id);return required("Piece",id);
    }); }
    private JSObject snapshot(JSObject piece,String draft) throws Exception {
        String id=piece.getString("id");JSObject shop=null;
        if(!piece.isNull("shopId")) {
            JSObject source=row("Shop","id",piece.getString("shopId"));
            if(source!=null) {
                String storefront=null;
                if(!source.isNull("storefrontPhotoId")) {JSObject photo=row("Photo","id",source.getString("storefrontPhotoId"));if(photo!=null) storefront=promote(owned(photo.getString("file")),"ResultDraft",draft,"storefront");}
                shop=obj("n",source.get("n"),"startedAt",source.get("startedAt"),"storefrontFile",storefront,"description",source.get("description"),"note",source.get("note"));
            }
        }
        return obj("pieceId",id,"origin",piece.get("origin"),"label",piece.get("label"),"category",piece.get("category"),"cutoutFile",promote(owned(piece.getString("cutoutFile")),"ResultDraft",draft,"cutout"),"walkTo",piece.get("walkTo"),"shop",shop);
    }
    @Override public synchronized JSObject prepareResult(JSObject input) { return transaction(()->{
        String target=id(input,"targetPieceId");JSObject piece=required("Piece",target);
        if(!"shop".equals(piece.getString("origin"))) throw error("invalid_input");
        JSONArray companions=input.optJSONArray("companionPieceIds");if(companions==null||companions.length()>5) throw error("invalid_input");
        Set<String> unique=new HashSet<>();unique.add(target);
        List<JSObject> pieces=new ArrayList<>();
        for(int i=0;i<companions.length();i++) {Object value=companions.opt(i);if(!(value instanceof String)||!unique.add((String)value)) throw error("invalid_input");pieces.add(required("Piece",(String)value));}
        String draft=uid();JSObject targetSnapshot=snapshot(piece,draft);JSONArray snapshots=new JSONArray();for(JSObject companion:pieces) snapshots.put(snapshot(companion,draft));
        db.insertOrThrow("ResultDraft",null,values("id",draft,"targetPieceId",target,"companionPieceIds",companions,"targetSnapshot",targetSnapshot,"companionSnapshots",snapshots));
        return obj("draftId",draft,"targetSnapshot",targetSnapshot,"companionSnapshots",snapshots);
    }); }
    private JSObject promoteSnapshot(JSObject snapshot,String result) throws Exception {
        JSObject copy=object(snapshot);
        copy.put("cutoutFile",promote(owned(copy.getString("cutoutFile")),"Result",result,"cutout"));
        if(!copy.isNull("shop")) {JSObject shop=nested(copy,"shop");if(!shop.isNull("storefrontFile")) shop.put("storefrontFile",promote(owned(shop.getString("storefrontFile")),"Result",result,"storefront"));copy.put("shop",shop);}
        return copy;
    }
    @Override public synchronized JSObject saveResult(JSObject input) { return transaction(()->{
        String draft=id(input,"draftId");JSObject existing=row("Result","id",draft);if(existing!=null) return existing;
        JSObject data=required("ResultDraft",draft);
        if(!(input.opt("faceless") instanceof Boolean)) throw error("invalid_input");
        String display=promote(owned(string(input,"file")),"Result",draft,"display"),provider=promote(owned(string(input,"providerFile")),"Result",draft,"provider");
        JSObject target=promoteSnapshot(nested(data,"targetSnapshot"),draft);JSONArray snapshots=new JSONArray(),old=data.getJSONArray("companionSnapshots");
        for(int i=0;i<old.length();i++) snapshots.put(promoteSnapshot(object(old.getJSONObject(i)),draft));
        insert("Result",values("id",draft,"targetPieceId",data.get("targetPieceId"),"companionPieceIds",data.get("companionPieceIds"),"targetSnapshot",target,"companionSnapshots",snapshots,"file",display,"faceless",input.getBoolean("faceless"),"providerFile",provider,"createdAt",System.currentTimeMillis()),draft);
        db.delete("ResultDraft","id=?",new String[]{draft});unown("ResultDraft",draft);return required("Result",draft);
    }); }
    @Override public synchronized JSObject discardResultDraft(JSObject input) { return transaction(()->{String id=id(input,"draftId");db.delete("ResultDraft","id=?",new String[]{id});unown("ResultDraft",id);return new JSObject();}); }
    private void cancelJobs(String kind,String ref) {
        try(Cursor c=db.query("QueueJob",new String[]{"id"},"kind=? AND refId=?",new String[]{kind,ref},null,null,null)) {
            while(c.moveToNext()) {String id=c.getString(0);claims.remove(id);changed("QueueJob",id);}
        }
        db.delete("QueueJob","kind=? AND refId=?",new String[]{kind,ref});
    }
    private void deletePhotoInternal(String id) throws Exception {
        JSObject photo=row("Photo","id",id);if(photo==null) return;
        purgeCandidates(id);
        JSObject shop=row("Shop","id",photo.getString("shopId"));
        if(shop!=null&&id.equals(shop.getString("storefrontPhotoId"))) update("Shop",values("storefrontPhotoId",null,"description",null,"descriptionState","none"),"id",shop.getString("id"));
        cancelJobs("describe_storefront",id);unown("Photo",id);db.delete("Photo","id=?",new String[]{id});
        changed("Photo",id);changed("PhotoEmbedding",id);changed("Piece",id);
    }
    @Override public synchronized JSObject deletePhoto(JSObject input) { return transaction(()->{deletePhotoInternal(id(input,"id"));return new JSObject();}); }
    @Override public synchronized JSObject deleteTrip(JSObject input) {
        String id=id(input,"id");JSObject trip=row("Trip","id",id);
        if(trip!=null&&"recording".equals(trip.getString("status"))) {
            if(sessionStopper==null) throw error("session_active");
            sessionStopper.run();
        }
        return transaction(()->{
            List<String> photos=new ArrayList<>();try(Cursor c=db.query("Photo",new String[]{"id"},"tripId=?",new String[]{id},null,null,null)) {while(c.moveToNext()) photos.add(c.getString(0));}
            for(String photo:photos) deletePhotoInternal(photo);
            db.delete("Trip","id=?",new String[]{id});changed("Trip",id);changed("Shop",id);changed("TrailPoint",id);changed("Piece",id);return new JSObject();
        });
    }
    @Override public synchronized JSObject deletePiece(JSObject input) { return transaction(()->{String id=id(input,"id");cancelJobs("label_piece",id);db.delete("Piece","id=?",new String[]{id});unown("Piece",id);changed("Piece",id);return new JSObject();}); }
    @Override public synchronized JSObject deleteResult(JSObject input) { return transaction(()->{String id=id(input,"id");db.delete("Result","id=?",new String[]{id});unown("Result",id);changed("Result",id);return new JSObject();}); }
    private JSObject enqueueInternal(String kind,String ref,boolean replace) {
        if(kind.equals("describe_storefront")) {
            JSObject photo=required("Photo",ref),shop=required("Shop",photo.getString("shopId"));
            if(!"storefront".equals(photo.getString("kind"))||!ref.equals(shop.getString("storefrontPhotoId"))) throw error("invalid_input");
            update("Shop",values("description",null,"descriptionState","pending"),"id",shop.getString("id"));
        } else required("Piece",ref);
        if(replace) cancelJobs(kind,ref);
        try(Cursor c=db.query("QueueJob",null,"kind=? AND refId=?",new String[]{kind,ref},null,null,null)) {if(c.moveToFirst()) return decode("QueueJob",c);}
        String id=uid();insert("QueueJob",values("id",id,"kind",kind,"refId",ref,"attempts",0,"nextAt",System.currentTimeMillis()),id);return required("QueueJob",id);
    }
    @Override public synchronized JSObject enqueue(JSObject input) { return transaction(()->enqueueInternal(choice(input,"kind","describe_storefront","label_piece"),id(input,"refId"),true)); }
    @Override public synchronized JSObject nextJob(JSObject input) {
        long now=time(input,"now");try(Cursor c=db.query("QueueJob",null,"nextAt<=?",new String[]{String.valueOf(now)},null,null,"nextAt,id")) {
            while(c.moveToNext()) {JSObject job=decode("QueueJob",c);if(!claims.contains(job.getString("id"))) return job;}return null;
        }
    }
    @Override public synchronized JSObject beginJob(JSObject input) { return transaction(()->{
        String id=id(input,"id");long now=time(input,"now");JSObject job=required("QueueJob",id);
        if(!claims.isEmpty()||job.getLong("nextAt")>now) throw error("job_unavailable");
        long attempts=job.getLong("attempts")+1;long delay=Math.min(300000L,5000L<<Math.min(attempts-1,6));
        update("QueueJob",values("attempts",attempts,"nextAt",Math.min(9007199254740991L,now+delay)),"id",id);
        claims.add(id);return required("QueueJob",id);
    }); }
    private boolean jobCurrent(JSObject job) {
        String ref=job.getString("refId");
        if("label_piece".equals(job.getString("kind"))) return row("Piece","id",ref)!=null;
        JSObject photo=row("Photo","id",ref);if(photo==null) return false;
        JSObject shop=row("Shop","id",photo.getString("shopId"));return shop!=null&&ref.equals(shop.getString("storefrontPhotoId"));
    }
    @Override public synchronized JSObject completeJob(JSObject input) { return transaction(()->{
        String id=id(input,"id");JSObject job=row("QueueJob","id",id);if(job==null) return new JSObject();
        if(!claims.contains(id)) throw error("job_unavailable");
        if(jobCurrent(job)) {
            String ref=job.getString("refId");
            if("describe_storefront".equals(job.getString("kind"))) {
                if(input.has("label")||input.has("category")) throw error("invalid_input");
                String description=text(input,"description",300);JSObject photo=required("Photo",ref);
                update("Shop",values("description",description,"descriptionState","done"),"id",photo.getString("shopId"));
            } else {
                if(input.has("description")) throw error("invalid_input");
                update("Piece",values("label",text(input,"label",120),"category",text(input,"category",64)),"id",ref);
            }
        }
        db.delete("QueueJob","id=?",new String[]{id});claims.remove(id);changed("QueueJob",id);return new JSObject();
    }); }
    @Override public synchronized JSObject failJob(JSObject input) { return transaction(()->{
        String id=id(input,"id");
        if(!(input.opt("retryable") instanceof Boolean)||(input.has("preflight")&&!(input.opt("preflight") instanceof Boolean))) throw error("invalid_input");
        boolean preflight=input.optBoolean("preflight",false);
        if(preflight&&(input.getBoolean("retryable")||input.has("retryAfterMs"))) throw error("invalid_input");
        JSObject job=row("QueueJob","id",id);if(job==null) return new JSObject();
        if(preflight?claims.contains(id):!claims.contains(id)) throw error("job_unavailable");
        if(input.getBoolean("retryable")&&jobCurrent(job)) {
            long next=job.getLong("nextAt");
            if(input.has("retryAfterMs")) next=Math.max(next,Math.min(9007199254740991L,System.currentTimeMillis()+time(input,"retryAfterMs")));
            update("QueueJob",values("nextAt",next),"id",id);
        } else {
            if(jobCurrent(job)&&"describe_storefront".equals(job.getString("kind"))) {
                JSObject photo=required("Photo",job.getString("refId"));update("Shop",values("description",null,"descriptionState","failed"),"id",photo.getString("shopId"));
            }
            db.delete("QueueJob","id=?",new String[]{id});changed("QueueJob",id);
        }
        claims.remove(id);return new JSObject();
    }); }
    @Override public synchronized JSObject discardTemp(JSObject input) {
        Uri uri=Uri.parse(string(input,"file"));
        String authority=uri.getAuthority();
        if(!"file".equals(uri.getScheme())||uri.getPath()==null||uri.getQuery()!=null||uri.getFragment()!=null||(authority!=null&&!authority.isEmpty())) throw error("file_not_owned");
        try {
            File file=new File(uri.getPath()).getCanonicalFile();
            if(!file.getPath().startsWith(context.getCacheDir().getCanonicalPath()+"/")||(file.exists()&&!file.isFile())) throw error("file_not_owned");
            String ref=Uri.fromFile(file).toString();
            JSObject result=transaction(()->{
                try(Cursor cursor=db.query("OwnedFile",new String[]{"ownerType"},"file=?",new String[]{ref},null,null,null)) {
                    if(cursor.moveToFirst()&&!"Candidate".equals(cursor.getString(0))) throw error("file_not_owned");
                }
                db.delete("OwnedFile","file=? AND ownerType='Candidate'",new String[]{ref});
                retire(ref);return new JSObject();
            });
            if(file.exists()) throw error("io_error");
            return result;
        } catch(java.io.IOException e) {throw error("io_error");}
    }
    @Override public synchronized JSObject getSession() {
        try(Cursor c=db.query("Trip",null,"status='recording'",null,null,null,null)) {
            if(!c.moveToFirst()) return obj("trip",null,"shop",null,"photos",new JSONArray(),"latestFix",null);
            JSObject trip=decode("Trip",c);String id=trip.getString("id");JSONArray photos=new JSONArray();
            try(Cursor pc=db.query("Photo",null,"tripId=?",new String[]{id},null,null,"takenAt,id")) {while(pc.moveToNext()) photos.put(decode("Photo",pc));}
            JSObject fix=null;try(Cursor tc=db.query("TrailPoint",null,"tripId=?",new String[]{id},null,null,"t DESC","1")) {if(tc.moveToFirst()) {fix=decode("TrailPoint",tc);fix.remove("tripId");}}
            return obj("trip",trip,"shop",latestShop(id),"photos",photos,"latestFix",fix);
        }
    }
    @Override public synchronized JSObject nearestFix(JSObject input) {
        String trip=id(input,"tripId");long t=time(input,"takenAt");
        try(Cursor c=db.rawQuery("SELECT * FROM TrailPoint WHERE tripId=? AND t BETWEEN ? AND ? AND accuracyM<=100 ORDER BY abs(t-?),t LIMIT 1",new String[]{trip,String.valueOf(Math.max(0,t-15000)),String.valueOf(t+15000),String.valueOf(t)})) {
            if(!c.moveToFirst()) return null;JSObject fix=decode("TrailPoint",c);fix.remove("tripId");return fix;
        }
    }
    @Override public synchronized JSObject getPhoto(JSObject input) {return row("Photo","id",id(input,"id"));}
}
