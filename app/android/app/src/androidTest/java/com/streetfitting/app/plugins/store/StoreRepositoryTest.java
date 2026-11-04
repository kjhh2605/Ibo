package com.streetfitting.app.plugins.store;

import static org.junit.Assert.*;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

@RunWith(AndroidJUnit4.class)
public class StoreRepositoryTest {
    Context context; SqliteRepository store;String database,directory,trip,shop,photo;List<File> inputs=new ArrayList<>();
    static JSObject o(Object... values) {JSObject o=new JSObject();for(int i=0;i<values.length;i+=2)o.put((String)values[i],values[i+1]==null?JSONObject.NULL:values[i+1]);return o;}
    @Before public void before() throws Exception {
        context=InstrumentationRegistry.getInstrumentation().getTargetContext();String suffix=UUID.randomUUID().toString();database="store-test-"+suffix+".db";directory="store-test-"+suffix;
        store=new SqliteRepository(context,database,directory);
        JSObject started=store.startSession(o("fix",fix(1000)));trip=started.getJSObject("trip").getString("id");shop=started.getJSObject("shop").getString("id");
        photo=commit("item").getString("id");
    }
    @After public void after() {
        if(store!=null)store.close();context.deleteDatabase(database);remove(new File(context.getFilesDir(),directory));for(File f:inputs)f.delete();
    }
    static void remove(File f) {File[] children=f.listFiles();if(children!=null)for(File child:children)remove(child);f.delete();}
    JSObject fix(long t) {return o("lat",37.5,"lng",-122.2,"accuracyM",5,"t",t);}
    String png(boolean mask) throws Exception {
        Bitmap image=Bitmap.createBitmap(4,4,Bitmap.Config.ARGB_8888);image.eraseColor(mask?Color.BLACK:Color.RED);
        if(mask){image.setPixel(1,1,Color.WHITE);image.setPixel(2,1,Color.WHITE);image.setPixel(1,2,Color.WHITE);image.setPixel(2,2,Color.WHITE);}
        File file=File.createTempFile("store-test-",".png",context.getCacheDir());inputs.add(file);
        try(FileOutputStream out=new FileOutputStream(file)){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}image.recycle();return Uri.fromFile(file).toString();
    }
    JSObject photoInput(String kind) throws Exception {return o("photo",o("id",UUID.randomUUID().toString(),"tripId",trip,"shopId",shop,"kind",kind,"takenAt",1200,"location",o("lat",37.5,"lng",-122.2,"accuracyM",5),"file",png(false),"w",4,"h",4,"indexState","pending"));}
    JSObject commit(String kind) throws Exception {return store.commitPhoto(photoInput(kind));}
    JSObject candidate(String source) throws Exception {return o("id","untrusted-id","photoId",source,"source","edgetam","label","Red jacket","score",0.8,"mask",png(true),"bbox",new JSONArray(new int[]{1,1,2,2}));}
    JSObject piece(String source,String mode) throws Exception {return store.saveCandidate(o("candidate",candidate(source),"origin","shop","labelMode",mode));}
    JSObject get(String entity,String id){return store.get(o("entity",entity,"id",id));}
    JSONArray list(String entity) throws Exception{return store.list(o("entity",entity)).getJSONArray("items");}
    File file(String ref){return new File(Uri.parse(ref).getPath());}
    void rejects(String code,Runnable call){try{call.run();fail("expected "+code);}catch(IllegalArgumentException e){assertEquals(code,e.getMessage());}}
    String relayMask() throws Exception {
        File directory=new File(context.getCacheDir(),"relay/candidate-mask");
        assertTrue(directory.isDirectory()||directory.mkdirs());
        File mask=new File(directory,UUID.randomUUID()+".png");inputs.add(mask);
        Files.copy(file(png(true)).toPath(),mask.toPath());return Uri.fromFile(mask).toString();
    }
    int ownedCount(String ref) throws Exception {
        ref=Uri.fromFile(file(ref).getCanonicalFile()).toString();
        StoreDatabase direct=new StoreDatabase(context,database);
        try(Cursor cursor=direct.getReadableDatabase().rawQuery("SELECT count(*) FROM OwnedFile WHERE file=?",new String[]{ref})) {
            assertTrue(cursor.moveToFirst());return cursor.getInt(0);
        } finally {direct.close();}
    }
    @Test public void discardedCandidateReleasesOwnershipAndSurvivesLateCleanup() throws Exception {
        String mask=relayMask();store.adoptCandidate(o("ownerId",photo,"file",file(mask).toURI().toString()));
        assertEquals("Candidate lookup: "+mask+"; canonical="+file(mask).getCanonicalPath(),1,ownedCount(mask));
        store.discardTemp(o("file",mask));
        assertFalse(file(mask).exists());assertEquals(0,ownedCount(mask));
        store.discardTemp(o("file",mask));
        String another=relayMask();store.adoptCandidate(o("ownerId",photo,"file",another));
        store.deletePhoto(o("id",photo));store.discardTemp(o("file",another));
        assertFalse(file(another).exists());assertEquals(0,ownedCount(another));
        String late=relayMask();
        rejects("invalid_reference",()->store.adoptCandidate(o("ownerId",photo,"file",late)));
        store.discardTemp(o("file",late));assertFalse(file(late).exists());
    }
    @Test public void temporaryCleanupCannotDeletePersistentPhotoOrResultDraft() throws Exception {
        String original=get("Photo",photo).getString("file");
        rejects("file_not_owned",()->store.discardTemp(o("file",original)));
        assertTrue(file(original).isFile());
        JSObject target=piece(photo,"concept");
        JSObject draft=store.prepareResult(o("targetPieceId",target.getString("id"),"companionPieceIds",new JSONArray()));
        String snapshot=draft.getJSObject("targetSnapshot").getString("cutoutFile");
        rejects("file_not_owned",()->store.discardTemp(o("file",snapshot)));
        assertTrue(file(snapshot).isFile());
        rejects("file_not_owned",()->store.discardTemp(o("file","file:///outside/not-present")));
    }
    @Test public void legacyOwnershipMigrationPreservesFilesAndCancelsStaleGarbage() throws Exception {
        String original=get("Photo",photo).getString("file");
        File directoryRoot=new File(context.getFilesDir(),directory);
        String relative=file(original).getCanonicalPath().substring(directoryRoot.getCanonicalPath().length()+1);
        String legacy=new File(directoryRoot,relative).toURI().toString();
        assertNotEquals(original,legacy);store.close();store=null;
        StoreDatabase direct=new StoreDatabase(context,database);
        try {
            var db=direct.getWritableDatabase();
            db.execSQL("UPDATE Photo SET file=? WHERE id=?",new Object[]{legacy,photo});
            db.execSQL("UPDATE OwnedFile SET file=? WHERE file=?",new Object[]{legacy,original});
            db.execSQL("INSERT INTO Garbage(file) VALUES(?)",new Object[]{legacy});
            db.setVersion(1);
        } finally {direct.close();}
        store=new SqliteRepository(context,database,directory);
        assertEquals(legacy,get("Photo",photo).getString("file"));
        assertTrue(file(original).isFile());assertEquals(1,ownedCount(legacy));
        store.deletePhoto(o("id",photo));assertFalse(file(original).exists());
    }
    @Test public void ambiguousLegacyOwnershipRollsBackWithoutDeletingFiles() throws Exception {
        String original=get("Photo",photo).getString("file"),alias=file(original).toURI().toString();
        assertNotEquals(original,alias);store.close();store=null;
        StoreDatabase direct=new StoreDatabase(context,database);
        try {
            var db=direct.getWritableDatabase();
            db.execSQL("INSERT INTO OwnedFile(file,ownerType,ownerId) VALUES(?,'Photo','conflicting-owner')",new Object[]{alias});
            db.setVersion(1);
        } finally {direct.close();}
        try {store=new SqliteRepository(context,database,directory);fail("Ambiguous physical ownership must reject migration");}
        catch(IllegalStateException expected) { }
        try(var db=android.database.sqlite.SQLiteDatabase.openDatabase(context.getDatabasePath(database).getPath(),null,android.database.sqlite.SQLiteDatabase.OPEN_READONLY);
            Cursor rows=db.rawQuery("SELECT count(*) FROM OwnedFile",null)) {
            assertEquals(1,db.getVersion());assertTrue(rows.moveToFirst());assertEquals(2,rows.getInt(0));
        }
        assertTrue(file(original).isFile());
    }
    @Test public void deletingPhotoAndDiscardingCandidateSerializeSafely() throws Exception {
        String mask=relayMask();store.adoptCandidate(o("ownerId",photo,"file",mask));
        ExecutorService executor=Executors.newFixedThreadPool(2);
        try {
            List<Callable<JSObject>> calls=List.of(()->store.deletePhoto(o("id",photo)),()->store.discardTemp(o("file",mask)));
            for(var result:executor.invokeAll(calls))result.get();
        } finally {executor.shutdown();}
        assertNull(get("Photo",photo));assertFalse(file(mask).exists());assertEquals(0,ownedCount(mask));
    }
    @Test public void preflightFailureEndsUnclaimedJobWithoutClaimingHttpAttempt() throws Exception {
        JSObject storefront=commit("storefront");
        JSObject job=store.nextJob(o("now",System.currentTimeMillis()));String id=job.getString("id");
        assertEquals(0,job.getLong("attempts"));
        rejects("constraint_violation",()->store.failJob(o("id",id,"preflight",true,"retryable",true)));
        rejects("constraint_violation",()->store.failJob(o("id",id,"preflight",true,"retryable",false,"retryAfterMs",0)));
        rejects("constraint_violation",()->store.failJob(o("id",id,"preflight","true","retryable",false)));
        rejects("job_not_claimed",()->store.failJob(o("id",id,"retryable",false)));
        assertEquals(0,get("QueueJob",id).getLong("attempts"));
        store.failJob(o("id",id,"preflight",true,"retryable",false));
        assertNull(get("QueueJob",id));assertEquals("failed",get("Shop",shop).getString("descriptionState"));
        assertEquals(storefront.getString("id"),get("Shop",shop).getString("storefrontPhotoId"));
        store.failJob(o("id",id,"preflight",true,"retryable",false));
        JSObject retry=store.enqueue(o("kind","describe_storefront","refId",storefront.getString("id")));String retryId=retry.getString("id");
        store.beginJob(o("id",retryId,"now",retry.getLong("nextAt")));
        rejects("job_not_claimed",()->store.failJob(o("id",retryId,"preflight",true,"retryable",false)));
        assertEquals(1,get("QueueJob",retryId).getLong("attempts"));
        store.completeJob(o("id",retryId,"description","A brick storefront"));
        assertEquals("done",get("Shop",shop).getString("descriptionState"));
    }
    @Test public void historicalStorefrontPreservesRecordingAndReplacesOnlyDescriptionPointer() throws Exception {
        JSObject old=commit("storefront");String original=old.getString("file");
        store.stopSession(o("tripId",trip,"endedAt",2000));
        JSObject active=store.startSession(o("fix",fix(3000)));
        String activeTrip=active.getJSObject("trip").getString("id");
        JSObject input=photoInput("storefront");
        JSObject captured=input.getJSObject("photo");captured.put("takenAt",4000);input.put("photo",captured);
        JSObject replacement=store.commitStorefront(input);
        assertEquals("ended",get("Trip",trip).getString("status"));
        assertEquals(activeTrip,store.getSession().getJSObject("trip").getString("id"));
        assertEquals(active.getJSObject("shop").getString("id"),store.getSession().getJSObject("shop").getString("id"));
        assertEquals(0,store.list(o("entity","TrailPoint","tripId",trip)).getJSONArray("items").length());
        JSONArray activeTrail=store.list(o("entity","TrailPoint","tripId",activeTrip)).getJSONArray("items");
        assertEquals(1,activeTrail.length());assertEquals(3000,activeTrail.getJSONObject(0).getLong("t"));
        assertEquals(replacement.getString("id"),get("Shop",shop).getString("storefrontPhotoId"));
        assertEquals("pending",get("Shop",shop).getString("descriptionState"));
        assertNotNull(get("Photo",old.getString("id")));assertTrue(file(original).isFile());
        JSONArray jobs=list("QueueJob");assertEquals(1,jobs.length());assertEquals(replacement.getString("id"),jobs.getJSONObject(0).getString("refId"));
        JSObject item=photoInput("item");
        rejects("constraint_violation",()->store.commitStorefront(item));
        rejects("constraint_violation",()->store.commitPhoto(item));
    }
    @Test public void historicalStorefrontCannotResurrectDeletedShop() throws Exception {
        JSObject input=photoInput("storefront");
        store.stopSession(o("tripId",trip,"endedAt",2000));store.deleteTrip(o("id",trip));
        rejects("invalid_reference",()->store.commitStorefront(input));
        assertEquals(0,list("Photo").length());assertEquals(0,list("QueueJob").length());assertNull(store.getSession().getJSObject("trip"));
    }

    @Test public void saveRestartDeletionAndLateEmbedding() throws Exception {
        JSObject saved=piece(photo,"concept");String cutout=saved.getString("cutoutFile"),original=get("Photo",photo).getString("file");
        JSONArray vector=new JSONArray();for(int i=0;i<512;i++)vector.put(i==0?1:0);
        JSObject embedding=o("photoId",photo,"model","pe-core-t16-image","dim",512,"vector",vector);
        store.commitEmbedding(o("embedding",embedding));
        store.close();store=new SqliteRepository(context,database,directory);
        assertEquals("done",get("Photo",photo).getString("indexState"));assertEquals(512,get("PhotoEmbedding",photo).getJSONArray("vector").length());assertTrue(file(cutout).isFile());
        store.stopSession(o("tripId",trip,"endedAt",2000));assertEquals(0,list("TrailPoint").length());assertEquals(1,list("Photo").length());
        store.deleteTrip(o("id",trip));assertNull(get("Photo",photo));assertNull(get("Shop",shop));assertNull(get("PhotoEmbedding",photo));assertFalse(file(original).exists());
        JSObject retained=get("Piece",saved.getString("id"));assertTrue(retained.isNull("photoId"));assertTrue(retained.isNull("shopId"));assertTrue(retained.isNull("tripId"));assertEquals(-122.2,retained.getJSONObject("walkTo").getDouble("lng"),0);assertTrue(file(cutout).exists());
        rejects("invalid_reference",()->store.commitEmbedding(o("embedding",embedding)));rejects("invalid_reference",()->store.markIndexFailed(o("photoId",photo)));
    }
    @Test public void concurrentMaskIdentityAndRollback() throws Exception {
        JSObject one=candidate(photo),two=candidate(photo);two.put("id","another-id");ExecutorService executor=Executors.newFixedThreadPool(2);
        try {
            List<Callable<JSObject>> calls=List.of(()->store.saveCandidate(o("candidate",one,"origin","shop","labelMode","describe")),()->store.saveCandidate(o("candidate",two,"origin","shop","labelMode","describe")));
            var results=executor.invokeAll(calls);assertEquals(results.get(0).get().getString("id"),results.get(1).get().getString("id"));
        } finally {executor.shutdown();}
        assertEquals(1,list("Piece").length());assertEquals(1,list("QueueJob").length());
        List<JSObject> events=new ArrayList<>();store.addChangeListener(event->{events.add(event);assertNotNull(get("Piece",listIdUnchecked("Piece")));});
        JSObject invalid=candidate(photo);invalid.put("bbox",new JSONArray(new int[]{0,0,4,4}));
        rejects("constraint_violation",()->store.saveCandidate(o("candidate",invalid,"origin","shop","labelMode","describe")));assertEquals(0,events.size());assertEquals(1,list("Piece").length());
    }
    String listIdUnchecked(String entity){try{return list(entity).getJSONObject(0).getString("id");}catch(Exception e){throw new AssertionError(e);}}
    @Test public void snapshotBytesSurviveEverySourceDeletionAndRename() throws Exception {
        JSObject storefront=commit("storefront"),target=piece(photo,"concept"),companion=piece(commit("item").getString("id"),"concept");
        String targetId=target.getString("id"),companionId=companion.getString("id");
        store.updateShop(o("id",shop,"note","  upstairs  "));
        JSObject draft=store.prepareResult(o("targetPieceId",targetId,"companionPieceIds",new JSONArray().put(companionId)));
        JSObject snapshot=draft.getJSObject("targetSnapshot");String cutout=snapshot.getString("cutoutFile"),front=snapshot.getJSONObject("shop").getString("storefrontFile");
        assertNotEquals(target.getString("cutoutFile"),cutout);assertArrayEquals(Files.readAllBytes(file(target.getString("cutoutFile")).toPath()),Files.readAllBytes(file(cutout).toPath()));assertNotEquals(storefront.getString("file"),front);
        store.updatePiece(o("id",targetId,"label","Changed","category","coat"));store.deletePiece(o("id",targetId));store.deletePiece(o("id",companionId));store.stopSession(o("tripId",trip,"endedAt",2000));store.deleteTrip(o("id",trip));
        assertTrue(file(cutout).exists());assertTrue(file(front).exists());assertEquals("Red jacket",snapshot.getString("label"));assertEquals("upstairs",snapshot.getJSONObject("shop").getString("note"));
        String provider=png(false);byte[] providerBytes=Files.readAllBytes(file(provider).toPath());
        JSObject result=store.saveResult(o("draftId",draft.getString("draftId"),"file",provider,"providerFile",provider,"faceless",true));
        assertFalse(file(cutout).exists());assertFalse(file(front).exists());assertNotEquals(result.getString("file"),result.getString("providerFile"));assertArrayEquals(providerBytes,Files.readAllBytes(file(result.getString("providerFile")).toPath()));
        assertEquals(result.toString(),store.saveResult(o("draftId",draft.getString("draftId"),"file","no-longer-needed","providerFile","no-longer-needed","faceless",true)).toString());
        String resultCutout=result.getJSONObject("targetSnapshot").getString("cutoutFile");store.deleteResult(o("id",result.getString("id")));assertFalse(file(resultCutout).exists());assertFalse(file(result.getString("file")).exists());assertFalse(file(result.getString("providerFile")).exists());
    }
    @Test public void queueClaimsBackoffRetryAfterAndLateResponses() throws Exception {
        JSObject saved=piece(photo,"describe");String id=saved.getString("id");JSObject job=store.nextJob(o("now",System.currentTimeMillis()));String jobId=job.getString("id");long now=job.getLong("nextAt");
        assertEquals(0,job.getLong("attempts"));
        for(int attempt=1;attempt<=8;attempt++) {
            JSObject begun=store.beginJob(o("id",jobId,"now",now));assertEquals(attempt,begun.getLong("attempts"));long delay=Math.min(300000L,5000L<<Math.min(attempt-1,6));assertEquals(now+delay,begun.getLong("nextAt"));
            final long n=now;rejects("job_not_claimed",()->store.beginJob(o("id",jobId,"now",n)));store.failJob(o("id",jobId,"retryable",true));now=begun.getLong("nextAt");assertNull(store.nextJob(o("now",now-1)));
        }
        store.beginJob(o("id",jobId,"now",now));long before=System.currentTimeMillis();store.failJob(o("id",jobId,"retryable",true,"retryAfterMs",10000000));assertTrue(get("QueueJob",jobId).getLong("nextAt")>=before+10000000);
        JSObject fresh=store.enqueue(o("kind","label_piece","refId",id));assertNotEquals(jobId,fresh.getString("id"));assertEquals(0,fresh.getLong("attempts"));
        store.beginJob(o("id",fresh.getString("id"),"now",fresh.getLong("nextAt")));store.updatePiece(o("id",id,"label","User title","category","custom"));store.completeJob(o("id",fresh.getString("id"),"label","Late AI","category","coat"));assertEquals("User title",get("Piece",id).getString("label"));
        JSObject old=commit("storefront");JSObject describe=store.nextJob(o("now",System.currentTimeMillis()));store.beginJob(o("id",describe.getString("id"),"now",describe.getLong("nextAt")));JSObject replacement=commit("storefront");store.completeJob(o("id",describe.getString("id"),"description","Late old description"));assertEquals(replacement.getString("id"),get("Shop",shop).getString("storefrontPhotoId"));assertTrue(get("Shop",shop).isNull("description"));assertNotNull(get("Photo",old.getString("id")));
        store.deletePhoto(o("id",replacement.getString("id")));assertEquals("none",get("Shop",shop).getString("descriptionState"));assertEquals(0,list("QueueJob").length());
    }
    @Test public void constraintsRollbackPrivacyAndPostCommitEvents() throws Exception {
        List<JSObject> events=new ArrayList<>();store.addChangeListener(event->{events.add(event);assertEquals("note",get("Shop",shop).getString("note"));});
        store.updateShop(o("id",shop,"note","note"));assertEquals(1,events.size());
        rejects("constraint_violation",()->store.updateShop(o("id",shop,"note","x".repeat(281))));assertEquals(1,events.size());
        rejects("invalid_argument",()->store.list(o("entity","Trip","origin","shop")));
        rejects("constraint_violation",()->store.appendTrail(o("tripId",trip,"fix",o("t",1300,"lat",91,"lng",0,"accuracyM",1))));
        StoreDatabase direct=new StoreDatabase(context,database);SQLiteDatabase db=direct.getWritableDatabase();try(Cursor c=db.rawQuery("PRAGMA foreign_keys",null)){assertTrue(c.moveToFirst());assertEquals(1,c.getInt(0));}
        try {db.execSQL("INSERT INTO Trip(id,startedAt,status) VALUES('second',0,'recording')");fail("partial unique invariant");}catch(android.database.sqlite.SQLiteConstraintException expected){}
        direct.close();
        store.stopSession(o("tripId",trip,"endedAt",2000));assertEquals(0,list("TrailPoint").length());assertEquals("note",get("Shop",shop).getString("note"));
    }
    @Test public void selfVersionPinsDraftCleanupAndStartupGarbageCollection() throws Exception {
        String raw=png(false),mask=png(true);JSObject first=store.replaceSelfPhoto(o("selfPhoto",o("file",raw,"headMask",mask,"maskedFile",raw,"updatedAt",100)));
        store.retainSelf(o("updatedAt",100));JSObject second=store.replaceSelfPhoto(o("selfPhoto",o("file",raw,"headMask",mask,"maskedFile",raw,"updatedAt",200)));
        assertTrue(file(first.getString("file")).exists());store.releaseSelf(o("updatedAt",100));assertFalse(file(first.getString("file")).exists());assertTrue(file(second.getString("file")).exists());
        rejects("file_not_owned",()->store.replaceSelfPhoto(o("selfPhoto",o("file",raw,"headMask","file:///not-owned/missing","maskedFile",raw,"updatedAt",300))));
        assertEquals(200,store.getSelfPhoto().getLong("updatedAt"));
        JSObject target=piece(photo,"concept"),draft=store.prepareResult(o("targetPieceId",target.getString("id"),"companionPieceIds",new JSONArray()));String draftFile=draft.getJSObject("targetSnapshot").getString("cutoutFile");
        File orphan=new File(new File(context.getFilesDir(),directory),"orphan.tmp");try(FileOutputStream output=new FileOutputStream(orphan)){output.write(7);}
        store.close();store=new SqliteRepository(context,database,directory);assertFalse(file(draftFile).exists());assertFalse(orphan.exists());assertTrue(file(second.getString("file")).exists());
        rejects("invalid_reference",()->store.saveResult(o("draftId",draft.getString("draftId"),"file",raw,"providerFile",raw,"faceless",true)));
    }
}
