package com.streetfitting.app.plugins.store;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

/** Versioned device-only data. No migration may silently erase user data. */
final class StoreDatabase extends SQLiteOpenHelper {
    StoreDatabase(Context context, String databaseName) { super(context, databaseName, null, 1); }
    @Override public void onConfigure(SQLiteDatabase db) { db.setForeignKeyConstraintsEnabled(true); }
    @Override public void onCreate(SQLiteDatabase db) {
        String id = " TEXT PRIMARY KEY NOT NULL CHECK(length(id) BETWEEN 1 AND 128)";
        String time = " INTEGER NOT NULL CHECK(%s BETWEEN 0 AND 9007199254740991)";
        String location = "lat REAL NOT NULL CHECK(lat BETWEEN -90 AND 90),lng REAL NOT NULL CHECK(lng BETWEEN -180 AND 180),accuracyM REAL NOT NULL CHECK(accuracyM>=0)";
        db.execSQL("CREATE TABLE Trip(id" + id + ",startedAt" + String.format(time,"startedAt") + ",endedAt INTEGER,status TEXT NOT NULL CHECK(status IN ('recording','ended')),CHECK((status='recording' AND endedAt IS NULL) OR (status='ended' AND endedAt>=startedAt AND endedAt<=9007199254740991)))");
        db.execSQL("CREATE UNIQUE INDEX one_recording_trip ON Trip(status) WHERE status='recording'");
        db.execSQL("CREATE TABLE Shop(id" + id + ",tripId TEXT NOT NULL REFERENCES Trip(id) ON DELETE CASCADE,n INTEGER NOT NULL CHECK(n>=1),startedAt" + String.format(time,"startedAt") + "," + location + ",storefrontPhotoId TEXT REFERENCES Photo(id) ON DELETE SET NULL,description TEXT,descriptionState TEXT NOT NULL CHECK(descriptionState IN ('none','pending','done','failed')),note TEXT,CHECK((descriptionState='done' AND length(trim(description)) BETWEEN 1 AND 300) OR (descriptionState!='done' AND description IS NULL)),CHECK(note IS NULL OR length(trim(note)) BETWEEN 1 AND 280),UNIQUE(tripId,n))");
        db.execSQL("CREATE TABLE Photo(id" + id + ",tripId TEXT NOT NULL REFERENCES Trip(id) ON DELETE CASCADE,shopId TEXT NOT NULL REFERENCES Shop(id) ON DELETE CASCADE,kind TEXT NOT NULL CHECK(kind IN ('item','storefront')),takenAt" + String.format(time,"takenAt") + "," + location + ",file TEXT NOT NULL UNIQUE,w INTEGER NOT NULL CHECK(w>0),h INTEGER NOT NULL CHECK(h>0),indexState TEXT NOT NULL CHECK(indexState IN ('pending','done','failed')))");
        db.execSQL("CREATE TRIGGER photo_shop_trip BEFORE INSERT ON Photo WHEN NOT EXISTS(SELECT 1 FROM Shop WHERE id=NEW.shopId AND tripId=NEW.tripId) BEGIN SELECT RAISE(ABORT,'photo_shop_trip'); END");
        db.execSQL("CREATE TABLE TrailPoint(tripId TEXT NOT NULL REFERENCES Trip(id) ON DELETE CASCADE,t" + String.format(time,"t") + "," + location + ",PRIMARY KEY(tripId,t))");
        db.execSQL("CREATE TABLE PhotoEmbedding(photoId TEXT PRIMARY KEY REFERENCES Photo(id) ON DELETE CASCADE,model TEXT NOT NULL CHECK(model='pe-core-t16-image'),dim INTEGER NOT NULL CHECK(dim=512),vector BLOB NOT NULL CHECK(length(vector)=2048))");
        db.execSQL("CREATE TABLE Piece(id" + id + ",origin TEXT NOT NULL CHECK(origin IN ('shop','wardrobe')),label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 120),category TEXT NOT NULL CHECK(length(trim(category)) BETWEEN 1 AND 64),cutoutFile TEXT NOT NULL UNIQUE,createdAt" + String.format(time,"createdAt") + ",photoId TEXT REFERENCES Photo(id) ON DELETE SET NULL,shopId TEXT REFERENCES Shop(id) ON DELETE SET NULL,tripId TEXT REFERENCES Trip(id) ON DELETE SET NULL,walkLat REAL CHECK(walkLat BETWEEN -90 AND 90),walkLng REAL CHECK(walkLng BETWEEN -180 AND 180),CHECK((origin='shop' AND walkLat IS NOT NULL AND walkLng IS NOT NULL) OR (origin='wardrobe' AND photoId IS NULL AND shopId IS NULL AND tripId IS NULL AND walkLat IS NULL AND walkLng IS NULL)))");
        db.execSQL("CREATE TABLE SelfPhoto(singleton INTEGER PRIMARY KEY CHECK(singleton=1),file TEXT NOT NULL,headMask TEXT NOT NULL,maskedFile TEXT NOT NULL,updatedAt" + String.format(time,"updatedAt") + ")");
        db.execSQL("CREATE TABLE SelfVersion(updatedAt INTEGER PRIMARY KEY,file TEXT NOT NULL,headMask TEXT NOT NULL,maskedFile TEXT NOT NULL)");
        db.execSQL("CREATE TABLE Result(id" + id + ",targetPieceId TEXT NOT NULL,companionPieceIds TEXT NOT NULL,targetSnapshot TEXT NOT NULL,companionSnapshots TEXT NOT NULL,file TEXT NOT NULL,faceless INTEGER NOT NULL CHECK(faceless IN (0,1)),providerFile TEXT NOT NULL,createdAt" + String.format(time,"createdAt") + ")");
        db.execSQL("CREATE TABLE ResultDraft(id TEXT PRIMARY KEY,targetPieceId TEXT NOT NULL,companionPieceIds TEXT NOT NULL,targetSnapshot TEXT NOT NULL,companionSnapshots TEXT NOT NULL)");
        db.execSQL("CREATE TABLE QueueJob(id" + id + ",kind TEXT NOT NULL CHECK(kind IN ('describe_storefront','label_piece')),refId TEXT NOT NULL,attempts INTEGER NOT NULL CHECK(attempts>=0),nextAt" + String.format(time,"nextAt") + ",UNIQUE(kind,refId))");
        db.execSQL("CREATE TABLE Asset(id TEXT PRIMARY KEY,file TEXT NOT NULL,w INTEGER NOT NULL CHECK(w>0),h INTEGER NOT NULL CHECK(h>0),purpose TEXT NOT NULL CHECK(purpose IN ('wardrobe','self')))");
        db.execSQL("CREATE TABLE OwnedFile(file TEXT PRIMARY KEY,ownerType TEXT NOT NULL,ownerId TEXT NOT NULL)");
        db.execSQL("CREATE TABLE Garbage(file TEXT PRIMARY KEY)");
        db.execSQL("CREATE INDEX photo_time ON Photo(takenAt DESC,id)");
        db.execSQL("CREATE INDEX queue_due ON QueueJob(nextAt,id)");
    }
    @Override public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
        throw new IllegalStateException("Unsupported database migration");
    }
}
