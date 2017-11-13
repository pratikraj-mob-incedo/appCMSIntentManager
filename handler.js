'use strict';
var throttledQueue = require('throttled-queue');
var request = require('request');
var _ = require('lodash');
var firebaseDB = require('./firebaseDB');
var helper = require('./helper');
var throttle = throttledQueue(5, 1000);

module.exports.create = (event, context, callback) => {
	var requestBody,
		mainJSONData,
		gHomeJSONData,
		siteID;
	var createPromise = new Promise(function(resolve, reject){
		firebaseDB.initializeDB()
		.then(function(){
			requestBody = JSON.parse(event.body);
			return helper.getRemoteJSON(requestBody.mainJSON);
		})
		.then(function(response){
			mainJSONData = response;
			siteID = mainJSONData.id;
			mainJSONData.mainJSON = requestBody.mainJSON;
			return helper.updateSiteData(mainJSONData)			
		})
		.then(function(){
			if(!mainJSONData.gHome){ reject({"error": "Unable to fetch google home data from the specified url in main.json"}); return; }
			return helper.getRemoteJSON(mainJSONData.gHome);
		})
		.then(function(response){
			gHomeJSONData = response;
			if(!gHomeJSONData.dialogFlow || !gHomeJSONData.intents){ reject({"error": "Please update details for google home."}); return; }
			return helper.getPublishedIntents(siteID);
		})
		.then(function(intents){
			var createUpdateIntentPromise = [];
			for(var action in gHomeJSONData.intents){
				if(gHomeJSONData.intents[action].length > 0){
					createUpdateIntentPromise.push(new Promise(function(resolve, reject){
						throttle(function(action) {
							var intentLocal = _.find(intents, function(o){ return o.actionName === action; });
							if(!intentLocal){
								helper.createNewIntent(siteID, gHomeJSONData.dialogFlow, gHomeJSONData.intents[action], action)
								.then(function(response){
									resolve(response);
								})
								.catch(function(err){
									resolve(err);
								});
							}else{
								console.log("Intent Local Found For " + action);
								helper.updateIntent(siteID, gHomeJSONData.dialogFlow, gHomeJSONData.intents[action], action, intentLocal.id)
								.then(function(response){
									resolve(response);
								})
								.catch(function(err){
									resolve(err);
								});
							}
						}, action);
					}));
				}
			}
			Promise.all(createUpdateIntentPromise)
			.then(function(response){
				console.log("Execution completed");
				resolve(response);
			});
		})
		.catch(function(err){
			reject(err); return;
		});
	});

	createPromise
	.then(function(data){
		const response = {
			statusCode: 200,
			body: JSON.stringify(data),
		};
		callback(null, response);
	}).catch(function(err){
		console.log(err);
		const response = {
			statusCode: 200,
			error: JSON.stringify(err),
		};
		callback(null, response);
	});
};