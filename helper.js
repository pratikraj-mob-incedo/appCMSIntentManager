'use strict';
var request = require('request');
var dynamoDB = require('./dynamoDB');
var firebaseDB = require('./firebaseDB');
var dialogFlowBaseUrl = 'https://api.dialogflow.com/v1/';

module.exports.getRemoteJSON = function(url){
	return new Promise(function(resolve, reject){
		request(url, function (error, response, body){
			if(!error && response.statusCode === 200){
				resolve(JSON.parse(body));
			}else{
				reject(error);
			}
		});
	});
}

module.exports.createSiteConfig = function(jsonData){
	const timestamp = new Date().getTime();
	jsonData.createdAt = timestamp;
	jsonData.updatedAt = timestamp;
	return new Promise(function(resolve, reject){
		const params = {
			TableName: process.env.GHomeSiteConfigDynamoDbTable,
			Item: jsonData
		};

		console.log("Creating site config with data: ", jsonData.actionStack);

		dynamoDB.put(params, (error) => {
			if (error) {
				reject(error);
				return;
			}else{
				var key = 'siteData/' + jsonData.internalName;
				firebaseDB.insertData(key, params.Item)
				.then(function(){
					resolve(jsonData);
					return;
				});
			}
		});
	});
}

module.exports.updateSiteData = function(jsonData){
	const timestamp = new Date().getTime();
	const siteID = jsonData.id;
	jsonData.createdAt = timestamp;
	jsonData.updatedAt = timestamp;
	return new Promise(function(resolve, reject){
		const params = {
			TableName: process.env.GHomeSiteConfigDynamoDbTable,
			KeyConditionExpression: "id = :siteID",
			ExpressionAttributeValues: {
				":siteID": siteID,
			}
		};
		dynamoDB.query(params, (error, result) => {
			if (error) {
				reject(error);
			}else{
				if(result.Items.length){
					const params = {
						TableName: process.env.GHomeSiteConfigDynamoDbTable,
						Item: jsonData
					};

					dynamoDB.put(params, (error) => {
						if (error) {
							reject(error);
							return;
						}else{
							console.log("Updating site config on firebase.");
							var key = 'siteData/' + jsonData.internalName;
							firebaseDB.insertData(key, params.Item)
							.then(function(){
								resolve(jsonData);
								return;
							});
						}
					});
				}else{
					module.exports.createSiteConfig(jsonData)
					.then(function(){
						resolve(jsonData);
						return;
					})
					.catch(function(err){
						reject(err);
						return;
					});
				}
			}
		});
	});
}

module.exports.getPublishedIntents = function(siteID){
	return new Promise(function(resolve, reject){
		const params = {
			TableName: process.env.GHomeIntentsDynamoDbTable,
			KeyConditionExpression: "siteID = :siteID",
			ExpressionAttributeValues: {
				":siteID": siteID,
			}
		};
		dynamoDB.query(params, (error, result) => {
			console.log(error);
			if (error) {
				resolve({});
				return;
			}else{
				resolve(result.Items);
				return;
			}
		});
	});
}

module.exports.getIntents = function(dialogflow){
	return new Promise(function(resolve, reject){
		var url = dialogFlowBaseUrl + 'intents/914ddd7f-8ce9-4379-b609-cab68c2b7b59';
	    var headers = {
	        'Authorization': 'Bearer ' + dialogflow.developerAccessToken,
	        'Content-Type':     'application/json'
	    }
	    var options = {
	        url: url,
	        method: 'GET',
	        headers: headers
	    }
		request(options, function (error, response, body){
			if(!error && response.statusCode === 200){
				resolve(JSON.parse(body));
				return;
			}else{
				reject(error);
				return;
			}
		});
	});
}


module.exports.createNewIntent = function(siteID, dialogflow, intentsArray, actionName){
	const timestamp = new Date().getTime();
	return new Promise(function(resolve, reject){
		var intentObject = generateIntentObject(intentsArray, actionName);
		var url = dialogFlowBaseUrl + 'intents';
	    var headers = {
	        'Authorization': 'Bearer ' + dialogflow.developerAccessToken,
	        'Content-Type':     'application/json'
	    }
	    var options = {
	        url: url,
	        method: 'POST',
	        headers: headers,
	        body: JSON.stringify(intentObject)
	    }
	    
		request(options, function (error, response, body){
			if(!error && response.statusCode === 200){
				var data = JSON.parse(body);
				if(data.status.code === 200 && data.status.errorType === 'success'){
					const params = {
						TableName: process.env.GHomeIntentsDynamoDbTable,
						Item: {
							id: data.id,
							siteID: siteID,
							actionName: actionName,
							intents: JSON.stringify(intentsArray),
							createdAt: timestamp,
							updatedAt: timestamp
						},
					};

					dynamoDB.put(params, (error) => {
						if (error) {
							console.error(error);
							reject(error);
							return;
						}
						resolve(intentObject);
					});
				}else{
					reject(body);
				}
			}else{
				reject(JSON.parse(body).status);
			}
		});
	});
}


module.exports.updateIntent = function(siteID, dialogflow, intentsArray, actionName, intentID){
	const timestamp = new Date().getTime();
	return new Promise(function(resolve, reject){
		var intentObject = generateIntentObject(intentsArray, actionName);
		var url = dialogFlowBaseUrl + 'intents/' + intentID;
	    var headers = {
	        'Authorization': 'Bearer ' + dialogflow.developerAccessToken,
	        'Content-Type':     'application/json'
	    }
	    var options = {
	        url: url,
	        method: 'PUT',
	        headers: headers,
	        body: JSON.stringify(intentObject)
	    }
		request(options, function (error, response, body){
			if(!error && response.statusCode === 200){
				var data = JSON.parse(body);
				if(data.status.code === 200 && data.status.errorType === 'success'){
					const params = {
						TableName: process.env.GHomeIntentsDynamoDbTable,
						Key:{
							"siteID": siteID,
							"id": intentID
						},
						UpdateExpression: "set intents = :intents",
						ExpressionAttributeValues:{
							":intents": JSON.stringify(intentsArray)
						},
						ReturnValues:"UPDATED_NEW"
					};
					dynamoDB.update(params, (error, data) => {
						if (error) {
							console.error(error);
							reject(error);
							return;
						}
						resolve(intentObject);
					});
				}else{
					reject(body);
				}
			}else{
				reject(JSON.parse(body).status);
			}
		});
	});
}


function generateIntentObject(intentsArray, actionName){
	var parameters = [];
	var events = [];
	var paramKeys = {};
	var userSays = intentsArray.map(function(intentText){
		var paramsList = [];
	    var regExp = /{([^}]+)}/g;
	    var curMatch;

	    while( curMatch = regExp.exec( intentText ) ) {
	    	paramKeys[curMatch[1]] = {
				"dataType": "@sys.any",
				"name": curMatch[1],
				"value": "\$" + curMatch[1]
	    	}
	        paramsList.push( curMatch[1] );
	    }

	    var userTextArray = intentText.split(new RegExp('[{}]', 'g'));
	    var userTextData = userTextArray.map(function(item){
	    	if(paramsList.indexOf(item) !== -1){
	    		return {
	    			"text": item,
	    			"alias": item,
	    			"meta": "@sys.any"
	    		}
	    	}else{
	    		return {
	    			"text": item
	    		}
	    	}
	    })
	    return {
	    	"data": userTextData
	    }
	});

	for(var key in paramKeys){
		parameters.push(paramKeys[key]);
	}

	if(actionName === 'welcome'){
		events.push({
	        "name": "WELCOME"
		});
	}

	return {
		"name": actionName,
		"auto": true,
		"templates": [],
		"userSays": userSays,
		"responses": [{
			"resetContexts": false,
			"action": actionName,
			"parameters": parameters
		}],
		"events": events,
		"webhookUsed": true,
		"priority": 500000
	};
}