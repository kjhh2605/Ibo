package com.streetfitting.app.plugins.store;

import static org.junit.Assert.*;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;

/** Default exercises durable reopen; explicit save/restart-delete phases run in distinct processes. */
@RunWith(AndroidJUnit4.class)
public class StoreProcessSmokeTest {
    @Test public void durableSaveRestartDelete() throws Exception {
        String phase=InstrumentationRegistry.getArguments().getString("storePhase","reopen");
        assertTrue("Unknown storePhase",phase.equals("reopen")||phase.equals("save")||phase.equals("restart-delete"));
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String database="store-process-smoke.db",directory="store-process-smoke";
        if(!phase.equals("restart-delete")) {context.deleteDatabase(database);StoreRepositoryTest.remove(new File(context.getFilesDir(),directory));}
        SqliteRepository store=new SqliteRepository(context,database,directory);
        try {
            if(!phase.equals("restart-delete")) {
                JSObject session=store.startSession(StoreRepositoryTest.o("fix",StoreRepositoryTest.o("t",100,"lat",37,"lng",-122,"accuracyM",3)));
                Bitmap image=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);image.eraseColor(Color.BLUE);File file=new File(context.getCacheDir(),"process-smoke.png");try(FileOutputStream out=new FileOutputStream(file)){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}image.recycle();
                store.commitPhoto(StoreRepositoryTest.o("photo",StoreRepositoryTest.o("id","persisted-photo","tripId",session.getJSObject("trip").getString("id"),"shopId",session.getJSObject("shop").getString("id"),"kind","storefront","takenAt",200,"location",StoreRepositoryTest.o("lat",37,"lng",-122,"accuracyM",3),"file",Uri.fromFile(file).toString(),"w",2,"h",2,"indexState","pending")));
                JSObject job=store.nextJob(StoreRepositoryTest.o("now",System.currentTimeMillis()));store.beginJob(StoreRepositoryTest.o("id",job.getString("id"),"now",job.getLong("nextAt")));
                assertEquals(1,store.list(StoreRepositoryTest.o("entity","Photo")).getJSONArray("items").length());
                if(phase.equals("save")) System.out.println("S06_PROCESS_SAVE: photo, storefront job and attempt persisted; pid="+android.os.Process.myPid());
                else {store.close();store=new SqliteRepository(context,database,directory);}
            }
            if(!phase.equals("save")) {
                JSObject photo=store.get(StoreRepositoryTest.o("entity","Photo","id","persisted-photo"));assertNotNull(photo);File original=new File(Uri.parse(photo.getString("file")).getPath());assertTrue(original.isFile());
                JSONArray jobs=store.list(StoreRepositoryTest.o("entity","QueueJob")).getJSONArray("items");assertEquals(1,jobs.length());assertEquals(1,jobs.getJSONObject(0).getInt("attempts"));
                long due=jobs.getJSONObject(0).getLong("nextAt");
                assertNull(store.nextJob(StoreRepositoryTest.o("now",due-1)));
                JSObject recovered=store.nextJob(StoreRepositoryTest.o("now",due));
                assertNotNull(recovered);assertEquals(jobs.getJSONObject(0).getString("id"),recovered.getString("id"));
                assertEquals(2,store.beginJob(StoreRepositoryTest.o("id",recovered.getString("id"),"now",recovered.getLong("nextAt"))).getInt("attempts"));
                store.stopSession(StoreRepositoryTest.o("tripId",photo.getString("tripId"),"endedAt",300));store.deleteTrip(StoreRepositoryTest.o("id",photo.getString("tripId")));assertFalse(original.exists());assertEquals(0,store.list(StoreRepositoryTest.o("entity","QueueJob")).getJSONArray("items").length());assertEquals(0,store.list(StoreRepositoryTest.o("entity","TrailPoint")).getJSONArray("items").length());
                store.completeJob(StoreRepositoryTest.o("id",jobs.getJSONObject(0).getString("id"),"description","Late response"));assertNull(store.get(StoreRepositoryTest.o("entity","Photo","id","persisted-photo")));
                System.out.println((phase.equals("reopen")?"S06_REOPEN_DELETE":"S06_PROCESS_RESTART_DELETE")+": persisted rows/files verified and late resurrection rejected; pid="+android.os.Process.myPid());
            }
        } finally {store.close();if(!phase.equals("save")){context.deleteDatabase(database);StoreRepositoryTest.remove(new File(context.getFilesDir(),directory));}}
    }
}
