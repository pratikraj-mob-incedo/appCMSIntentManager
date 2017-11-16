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
			if(!response.gHome){ 
				throw new Error({"error": "Unable to fetch google home data from the specified url in main.json"});
			}
			mainJSONData = response;
			siteID = mainJSONData.id;
			return helper.getRemoteJSON(mainJSONData.gHome);
		})
		.then(function(response){
			var actionStack = {};
			gHomeJSONData = response;
			if(!gHomeJSONData.dialogFlow){
				throw new Error({"error": "Please update details for google home."});
			}
			for(var actionName in gHomeJSONData.actions){
				actionStack[actionName] = {
					responseText: gHomeJSONData.actions[actionName].responseText || null,
					categoryMap: gHomeJSONData.actions[actionName].categoryMap || null
				}
			}
			var siteData = {
				id: mainJSONData.id,
				version: mainJSONData.version,
				site: mainJSONData.site,
				internalName: mainJSONData.internalName,
				category: mainJSONData.category,
				accessKey: mainJSONData.accessKey,
				apiBaseUrl: mainJSONData.apiBaseUrl,
				companyName: mainJSONData.companyName,
				serviceType: mainJSONData.serviceType,
				gHomeJSON: mainJSONData.gHome,
				categoriesPageId: gHomeJSONData.categoriesPageId,
				actionStack: actionStack
			}
			return helper.updateSiteData(siteData);
		})
		.then(function(response){
			return helper.getPublishedIntents(siteID);
		})
		.then(function(intents){
			var createUpdateIntentPromise = [];
			for(var action in gHomeJSONData.actions){
				if(gHomeJSONData.actions[action].intents.length > 0){
					createUpdateIntentPromise.push(new Promise(function(resolve, reject){
						throttle(function(action) {
							var intentLocal = _.find(intents, function(o){ return o.actionName === action; });
							if(!intentLocal){
								console.log("Intent Local Not Found For " + action);
								helper.createNewIntent(siteID, gHomeJSONData.dialogFlow, gHomeJSONData.actions[action].intents, action)
								.then(function(response){
									resolve(response);
								})
								.catch(function(err){
									resolve(err);
								});
							}else{
								console.log("Intent Local Found For " + action);
								helper.updateIntent(siteID, gHomeJSONData.dialogFlow, gHomeJSONData.actions[action].intents, action, intentLocal.id)
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
				resolve(response);
			});
		})
		.catch(function(err){
			reject(err);
			return;
		});
	});

	createPromise
	.then(function(data){
		const response = {
			statusCode: 200,
			body: JSON.stringify({
				success: true,
				data: data
			}),
		};
		// callback(null, response);
		context.done(null, response);
	}).catch(function(err){
		const response = {
			statusCode: 200,
			error: JSON.stringify({
				success: false,
				err: err
			}),
		};
		// callback(null, response);
		context.done(null, response);
	});
};