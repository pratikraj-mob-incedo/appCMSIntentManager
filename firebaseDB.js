var firebase = require('firebase');
var admin = require("firebase-admin");
var config = require("./config");
var dbConnection = null;

module.exports.initializeDB = function(){
	var firebaseConfig = config.firebase;
	return new Promise(function(resolve, reject){
		if(dbConnection == null){
			if(admin.apps.length){
				dbConnection = admin.app().database();
			}else{
				dbConnection = admin.initializeApp({
					credential: admin.credential.cert(firebaseConfig.account),
					databaseURL: firebaseConfig.url
				}).database();
			}
		}
		resolve();
	});
}

module.exports.closeDB = function(){
	var firebaseConfig = config.firebase;
	return new Promise(function(resolve, reject){
		if(dbConnection == null){
			if(admin.apps.length){
				dbConnection = admin.app().database();
			}else{
				dbConnection = admin.initializeApp({
					credential: admin.credential.cert(firebaseConfig.account),
					databaseURL: firebaseConfig.url
				}).database();
			}
		}
		dbConnection.goOffline();
		resolve();
	});
}

module.exports.insertData = function(key, data){
	return new Promise(function(resolve, reject){
		dbConnection.ref(key).set(data);
		resolve();
	});
}

module.exports.retrieveData = function(key){
	return new Promise(function(resolve, reject){
		var ref = dbConnection.ref(key);
		ref.once("value", function(snapshot) {
			if(snapshot.val() !== null){
				resolve(snapshot.val());
			}
			reject("Data not found");
		}, function(err){
			reject("Data not found");
		});
	});
}