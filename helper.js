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
	console.log("createSiteConfig");
	const timestamp = new Date().getTime();
	return new Promise(function(resolve, reject){
		const params = {
			TableName: process.env.GHomeSiteConfigDynamoDbTable,
			Item: {
				id: jsonData.id,
				version: jsonData.version,
				site: jsonData.site,
				internalName: jsonData.internalName,
				siteCategory: jsonData.siteCategory,
				accessKey: jsonData.accessKey,
				apiBaseUrl: jsonData.apiBaseUrl,
				companyName: jsonData.companyName,
				serviceType: jsonData.serviceType,
				mainJSON: jsonData.mainJSON,
				gHomeJSON: jsonData.gHome,
				createdAt: timestamp,
				updatedAt: timestamp
			},
		};

		dynamoDB.put(params, (error) => {
			if (error) {
				reject(error);
				return;
			}else{
				console.log("Creating site config on firebase.");
				var key = 'siteData/' + jsonData.internalName;
				firebaseDB.insertData(key, params.Item)
				.then(function(){
					resolve(jsonData);
				});
			}
		});
	});
}

module.exports.updateSiteData = function(jsonData){
	const timestamp = new Date().getTime();
	const siteID = jsonData.id;
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
						Item: {
							id: jsonData.id,
							version: jsonData.version,
							site: jsonData.site,
							internalName: jsonData.internalName,
							siteCategory: jsonData.siteCategory,
							accessKey: jsonData.accessKey,
							apiBaseUrl: jsonData.apiBaseUrl,
							companyName: jsonData.companyName,
							serviceType: jsonData.serviceType,
							mainJSON: jsonData.mainJSON,
							gHomeJSON: jsonData.gHome,
							createdAt: timestamp,
							updatedAt: timestamp
						},
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
			}else{
				resolve(result.Items);
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
			}else{
				reject(error);
			}
		});
	});
}


module.exports.createNewIntent = function(siteID, dialogflow, intentsArray, actionName){
	const timestamp = new Date().getTime();
	return new Promise(function(resolve, reject){
		var intentObject = generateIntentObject(intentsArray, actionName);
		// resolve(intentObject);
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
		"webhookUsed": true,
		"priority": 500000
	};


	// return {
	//    "name": "change appliance state",
	//    "auto": true,
	//    "contexts": [],
	//    "templates": [],
	//    "userSays": [
	//       {
	//          "data": [
	//             {
	//                "text": "turn "
	//             },
	//             {
	//                "text": "on",
	//                "alias": "state",
	//                "meta": "@state"
	//             },
	//             {
	//                "text": " the "
	//             },
	//             {
	//                "text": "kitchen lights",
	//                "alias": "appliance",
	//                "meta": "@appliance"
	//             }
	//          ],
	//          "isTemplate": false,
	//          "count": 0
	//       },
	//       {
	//          "data": [
	//             {
	//                "text": "switch the "
	//             },
	//             {
	//                "text": "heating",
	//                "alias": "appliance",
	//                "meta": "@appliance"
	//             },
	//             {
	//                "text": " "
	//             },
	//             {
	//                "text": "off",
	//                "alias": "state",
	//                "meta": "@state"
	//             }
	//          ],
	//          "isTemplate": false,
	//          "count": 0
	//       }
	//    ],
	//    "responses": [
	//       {
	//          "resetContexts": false,
	//          "action": "set-appliance",
	//          "affectedContexts": [
	//             {
	//                "name": "house",
	//                "lifespan": 10
	//             }
	//          ],
	//          "parameters": [
	//             {
	//                "dataType": "@appliance",
	//                "name": "appliance",
	//                "value": "\$appliance"
	//             },
	//             {
	//                "dataType": "@state",
	//                "name": "state",
	//                "value": "\$state"
	//             }
	//          ],
	//          "speech": "Turning the \$appliance \$state\!"
	//       }
	//    ],
	//    "priority": 500000
	// }
}


function asyncLoop(iterations, func, callback) {
    var index = 0;
    var done = false;
    var loop = {
        next: function() {
            if (done) {
                return;
            }

            if (index < iterations) {
                index++;
                func(loop);

            } else {
                done = true;
                callback();
            }
        },

        iteration: function() {
            return index - 1;
        },

        break: function() {
            done = true;
            callback();
        }
    };
    loop.next();
    return loop;
}