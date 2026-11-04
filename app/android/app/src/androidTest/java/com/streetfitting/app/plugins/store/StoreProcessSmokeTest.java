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

/** Invoked in two distinct instrumentation processes to prove persistence beyond Java singletons. */
@RunWith(AndroidJUnit4.class)
public class StoreProcessSmokeTest {
    @Test public void durableSaveRestartDelete() throws Exception {
        String phase=InstrumentationRegistry.getArguments().getString("storePhase","skip");
        if(phase.equals("skip")) return;
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();String database="store-process-smoke.db",directory="store-process-smoke";
        if(phase.equals("save")) {context.deleteDatabase(database);StoreRepositoryTest.remove(new File(context.getFilesDir(),directory));}
        SqliteRepository store=new SqliteRepository(context,database,directory);
        try {
            if(phase.equals("save")) {
                JSObject session=store.startSession(StoreRepositoryTest.o("fix",StoreRepositoryTest.o("t",100,"lat",37,"lng",-122,"accuracyM",3)));
                Bitmap image=Bitmap.createBitmap(2,2,Bitmap.Config.ARGB_8888);image.eraseColor(Color.BLUE);File file=new File(context.getCacheDir(),"process-smoke.png");try(FileOutputStream out=new FileOutputStream(file)){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}image.recycle();
                store.commitPhoto(StoreRepositoryTest.o("photo",StoreRepositoryTest.o("id","persisted-photo","tripId",session.getJSObject("trip").getString("id"),"shopId",session.getJSObject("shop").getString("id"),"kind","storefront","takenAt",200,"location",StoreRepositoryTest.o("lat",37,"lng",-122,"accuracyM",3),"file",Uri.fromFile(file).toString(),"w",2,"h",2,"indexState","pending")));
                JSObject job=store.nextJob(StoreRepositoryTest.o("now",System.currentTimeMillis()));store.beginJob(StoreRepositoryTest.o("id",job.getString("id"),"now",job.getLong("nextAt")));
                assertEquals(1,store.list(StoreRepositoryTest.o("entity","Photo")).getJSONArray("items").length());
                System.out.println("S06_PROCESS_SAVE: photo, storefront job and attempt persisted; pid="+android.os.Process.myPid());
            } else if(phase.equals("restart-delete")) {
                JSObject photo=store.get(StoreRepositoryTest.o("entity","Photo","id","persisted-photo"));assertNotNull(photo);File original=new File(Uri.parse(photo.getString("file")).getPath());assertTrue(original.isFile());
                JSONArray jobs=store.list(StoreRepositoryTest.o("entity","QueueJob")).getJSONArray("items");assertEquals(1,jobs.length());assertEquals(1,jobs.getJSONObject(0).getInt("attempts"));
                store.setSessionStopper(()->{});store.deleteTrip(StoreRepositoryTest.o("id",photo.getString("tripId")));assertFalse(original.exists());assertEquals(0,store.list(StoreRepositoryTest.o("entity","QueueJob")).getJSONArray("items").length());assertEquals(0,store.list(StoreRepositoryTest.o("entity","TrailPoint")).getJSONArray("items").length());
                store.completeJob(StoreRepositoryTest.o("id",jobs.getJSONObject(0).getString("id"),"description","Late response"));assertNull(store.get(StoreRepositoryTest.o("entity","Photo","id","persisted-photo")));
                System.out.println("S06_PROCESS_RESTART_DELETE: independent process observed persisted rows/files and deletion rejected late resurrection; pid="+android.os.Process.myPid());
            } else throw new AssertionError("Unknown storePhase");
        } finally {store.close();if(phase.equals("restart-delete")){context.deleteDatabase(database);StoreRepositoryTest.remove(new File(context.getFilesDir(),directory));}}
    }
}
