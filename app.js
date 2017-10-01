/* global N */
/*-----------------------------------------------------------------------------
A simple echo bot for the Microsoft Bot Framework.
-----------------------------------------------------------------------------*/

var restify = require('restify');
var builder = require('botbuilder');
var azure = require('azure-storage');

var Nuance = require('./nuance.js');
var WebSocket = require('ws');


//Nuance variables
var _ws = undefined;
var WebSocketServer = require('websocket').server;
var WebSocketClient = require('websocket').client;
var WebSocketFrame  = require('websocket').frame;
var WebSocketRouter = require('websocket').router;
var W3CWebSocket = require('websocket').w3cwebsocket;
var URL = 'wss://ws.dev.nuance.com/?';

var APP_ID = "NMDPTRIAL_tristantoupin_gmail_com20170929203611";
var APP_KEY = "55c043a0b0f884461c373dcfe899931c51e3a37cf0329ae678b82816dcca70318ab3d23bab5681c78dbe9776572a92a80d3525fe68bfe4e0770cf654d7668561";
var USER_ID = "";
var NLU_TAG = "M7860_A2953";

// ASR
// See: https://developer.nuance.com/public/index.php?task=supportedLanguages
var ASR_LANGUAGE = "eng-USA";

// TTS
// See: https://developer.nuance.com/public/index.php?task=supportedLanguages
var TTS_LANGUAGE = "eng-USA";
var TTS_VOICE = "";


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url);
});

// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword,
    stateEndpoint: process.env.BotStateEndpoint,
    openIdMetadata: process.env.BotOpenIdMetadata
});

// Listen for messages from users
server.post('/api/messages', connector.listen());

/*----------------------------------------------------------------------------------------
* Bot Storage: This is a great spot to register the private state storage for your bot.
* We provide adapters for Azure Table, CosmosDb, SQL Azure, or you can implement your own!
* For samples and documentation, see: https://github.com/Microsoft/BotBuilder-Azure
* ---------------------------------------------------------------------------------------- */

// Create your bot with a function to receive messages from the user
var bot = new builder.UniversalBot(connector);


// Intercept trigger event (ActivityTypes.Trigger)
bot.on('trigger', function (message) {
    // handle message from trigger function
    var queuedMessage = message.value;
    var reply = new builder.Message()
        .address(queuedMessage.address)
        .text('This is coming from the trigger: ' + queuedMessage.text);
    //bot.send(reply);
});

// Handle message from user
bot.dialog('/', function (session) {
    var queuedMessage = { address: session.message.address, text: session.message.text };
    // add message to queue
    session.sendTyping();
    var queueSvc = azure.createQueueService(process.env.AzureWebJobsStorage);
    queueSvc.createQueueIfNotExists('bot-queue', function(err, result, response){
        if(!err){
            // Add the message to the queue
            var queueMessageBuffer = new Buffer(JSON.stringify(queuedMessage)).toString('base64');
            queueSvc.createMessage('bot-queue', queueMessageBuffer, function(err, result, response){
                if(!err){

                    var msg = session.message;

                    if (msg.attachments && msg.attachments.length > 0) {
                        // Echo back attachment
                        var attachment = msg.attachments[0];

                        convertImageToText(session, attachment.contentUrl);

                    } else {
                        // Text message
                        textNlu(session, session.message.text);
                    }

                } else {
                    // this should be a log for the dev, not a message to the user
                    session.send('There was an error inserting your message into queue');
                }
            });
        } else {
            // this should be a log for the dev, not a message to the user
            session.send('There was an error creating your queue');
        }
    });

});

function processMessage(session, NLUvalue, NLUconcepts){

  console.log("these are the concepts:\n" + JSON.stringify(NLUconcepts));
  var isMultiple = NLUconcepts ? JSON.stringify(NLUconcepts).includes("multiple") : false;


  if (session && NLUvalue) {
      var response;
      var index;
      var NO_MATCH_sample = ["Sorry, I didn't get this! :/...","-_-.. I am not that smart! Explain it in another way please!"];
      var greeting_sample = ["Hey you!", "Hello", "Hi", "Ahoy! 🏴‍☠️"];
      var save_contact_sample = ["Let me save this contact for you!","I'll save this!", "Saved! :D", "I just saved it! ;)", "I'll take care of this!"];
      var get_contact_sample = ["Let me get that for you!","Let me see if I can find this...","Let me see if I can find this for you...","Let me check if I can find anything"];
      var save_event_sample = ["Let me save this event for you! ;)","I'll save this!", "Saved! :D", "I just saved it! ;)", "I'll take care of this!"];
      var get_event_sample = ["Let me get this event for you!","I'll get this!", "Got it! :D", "Here it is ;)","Tatam!! ;)"];

      if (NLUvalue == "nuance_chatbot_greeting") {
        index = Math.floor((Math.random() * greeting_sample.length));
        response = greeting_sample[index];
      }

      else if (NLUvalue == "eventai_help") {
        response = "This is how it works: \nTake a photo of a business card or a poster of an event you are interested in. We will save it for you! Let me know if you want to see any of your contacts of events ✌️";
      }

      else if (NLUvalue == "eventai_save_contact"){
        index = Math.floor((Math.random() * save_contact_sample.length));
        response = save_contact_sample[index];
      }

      else if (NLUvalue == "eventai_get_contact"){
        index = Math.floor((Math.random() * get_contact_sample.length));
        response = get_contact_sample[index];
        if (isMultiple){
              console.log("multiple");
          setTimeout(function() {accessDatabase(session, "getAllContacts", "")}, 2000);
        } else {
              console.log("single");
          accessDatabase(session, "getLatestContact", "");
        }
      }

      else if (NLUvalue == "eventai_save_event"){
        index = Math.floor((Math.random() * save_event_sample.length));
        response = save_event_sample[index];
      }

      else if (NLUvalue == "eventai_get_event"){
        index = Math.floor((Math.random() * get_event_sample.length));
        response = get_event_sample[index];
        if (isMultiple){
              console.log("multiple");
          setTimeout(function() {accessDatabase(session, "getAllEvents", "")}, 2000);
        } else {
              console.log("single");
          setTimeout(function() {accessDatabase(session, "getLatestEvent", "")}, 2000);
        }
      }

      else {
        index = Math.floor((Math.random() * NO_MATCH_sample.length));
        response = NO_MATCH_sample[index];
      }
      session.send(response);
  }
}


function accessDatabase(session, action, data) {

    console.log("ACTION : " + action);

    var Connection = require('tedious').Connection;
    var Request = require('tedious').Request;

    // Create connection to database
    var config =
       {
         userName: 'knksdfkdnfn', // update me
         password: '3h2hb3v3j3n43ASDF#@', // update me
         server: 'eventai.database.windows.net', // update me
         options:
            {
               database: 'EventAI_Database' //update me
               , encrypt: true
            }
       }
    var connection = new Connection(config);

    // Attempt to connect and execute queries if connection goes through
    connection.on('connect', function(err)
       {
         if (err)
           {
              console.log(err);
           }
        else
           {
               console.log("IT IS A SUCCESSSSSSSS");
               queryDatabase();
           }
       }
     );

     function queryDatabase() {
         console.log('Reading rows from the Table...');

         function guid() {
            function s4() {
              return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
            }
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
              s4() + '-' + s4() + s4() + s4();
          }

         var milliseconds = (new Date).getTime();
         var requestString = "";
         var msg = session.message.text;
         var uuid = guid();
         var selectQuery = false;
         if (action == "saveUser") {
           requestString = "INSERT INTO users (time_created, id, name) VALUES ('" + milliseconds + "', '" + session.message.user.id + "', '" + session.message.user.name + "')";
         } else if (action == "saveEvent") {
           var picture_url = session.message.attachments[0].contentUrl;
           requestString = "INSERT INTO events (time, user_id, event_name, event_description, event_time, picture_url) VALUES ('" + milliseconds + "', '" + session.message.user.id + "', '" + data.name + "', '" + data.description + "', '" + data.time + "', '" + picture_url + "')";
         } else if (action == "saveContact") {
           var picture_url = session.message.attachments[0].contentUrl;
           requestString = "INSERT INTO contacts (time_created, created_by, id, name, company, phones, email, address, website, picture_url, description) VALUES ('" + milliseconds + "', '" + session.message.user.id + "', '" + uuid + "', '" + data.name + "', '" + data.company + "', '" + data.phones + "', '" + data.email + "', '" + data.address + "', '" + data.website + "', '" + picture_url + "', '" + data.description + "')";
         } else if (action == "getLatestContact") {
           requestString = "SELECT top 1 * FROM contacts WHERE created_by = '" + session.message.user.id + "' ORDER BY time_created DESC";
           selectQuery = true;
         } else if (action == "getAllContacts") {
           requestString = "SELECT * FROM contacts WHERE created_by = '" + session.message.user.id + "' ORDER BY time_created DESC";
           selectQuery = true;
         } else if (action == "getLatestEvent") {
           requestString = "SELECT top 1 * FROM events WHERE user_id = '" + session.message.user.id + "' ORDER BY time DESC";
           selectQuery = true;
         } else if (action == "getAllEvents") {
           requestString = "SELECT * FROM events WHERE user_id = '" + session.message.user.id + "' ORDER BY time DESC";
           selectQuery = true;
         }

           // Read all rows from table
         request = new Request( requestString,
                 function(err, rowCount, rows)
                    {
                        console.log(rowCount + ' row(s) returned');
                    }
                );

         connection.execSql(request);

         if (selectQuery) {
           request.on('row', function(columns) {

             var response = "";

              columns.forEach(function(column) {
                  // console.log("%s\t%s", column.metadata.colName, column.value);

                  if (action == "getLatestContact" || action == "getAllContacts") {
                      if (column.metadata.colName == "name") {
                          response += "👥 Name \n\n" + column.value;
                      } else if (column.metadata.colName == "phones") {
                          response += "\n\n📞 Phones" + column.value;
                      } else if (column.metadata.colName == "email") {
                          response += "\n\n📧 Email" + column.value;
                      } else if (column.metadata.colName == "website") {
                          response += "\n\n🔗 Website" + column.value;
                      }
                  } else {
                      if (column.metadata.colName == "event_name") {
                          response += "👥 Name \n\n" + column.value;
                      } else if (column.metadata.colName == "event_time") {
                          response += "\n\n🕑 Time \n\n" + column.value;
                      } else if (column.metadata.colName == "event_description") {
                          response += "\n\n📖 Description" + column.value;
                      }
                  }

              });

              console.log("RESPONSE : " + response);
              session.send(response);

         });
         }
    }
}

function convertImageToText(session, imageURL) {

    var subscriptionKey = "267a20ca7909484394b6ce068151a477";
    var uriBase = "https://southcentralus.api.cognitive.microsoft.com/vision/v1.0/ocr";

    var params = "language=unk&detectOrientation=true";

    var headers = {
        'Content-Type' : 'application/json',
        'Ocp-Apim-Subscription-Key': subscriptionKey
    };


    var request = require('request');
    request.post({url: uriBase + "?" + params, json: true, body: {'url' : imageURL}, headers: {'Ocp-Apim-Subscription-Key' : subscriptionKey}}, function(err, res, body) {

        console.log("body : " + JSON.stringify(body));

        if (!err && res.statusCode === 200) {

            formatImageResponse(session, JSON.stringify(body));
        }
    });

};



//Nuance variables
var defaultOptions = {
    onopen: function() {
        console.log("Websocket Opened");
    },
    onclose: function() {
        console.log("Websocket Closed");
    },
    onvolume: function(vol) {
        viz(vol);
    },
    onresult: function(session, msg) {
        console.log('=========================');
        console.log(msg);
        var error = true;
        if (msg.nlu_interpretation_results) {
          if (msg.nlu_interpretation_results.payload) {
            if (msg.nlu_interpretation_results.payload.interpretations) {
              error = false;

              var first_interpretation = msg.nlu_interpretation_results.payload.interpretations[0];
              if (first_interpretation && first_interpretation.action && first_interpretation.action.intent && first_interpretation.action.intent.value) {
                var NLUvalue = first_interpretation.action.intent.value;
                var NLUconcepts = first_interpretation.concepts;
                console.log("\n\n\n===++++++========");
                console.log(first_interpretation.concepts);
                console.log("\n\n\n===++++++========");
                processMessage(session, NLUvalue, NLUconcepts);
              }

              //session.send(JSON.stringify(msg.nlu_interpretation_results.payload.interpretations[0]));
            }
          }
        }

        if (error) {
          //session.send("There was an error with Nuance...");
        }

        console.log('=========================');
    },

    onerror: function(error) {
        LOG(error);
        console.error(error);
    }
};

function formatImageResponse(session, jsonInput) {

    var json = JSON.parse(jsonInput);
    var dict = require('./dict.json')
    var num = Array.from(new Array(99), (val,index) =>index.toString());
    var temp_table = []
    var target
    var H_Array = []
    var W_Array = []
    var dates = []
    var type = "person"
    var reg_t = /([+]{0,1}[0-9]{1,2}[- ]{0,1}){0,1}([0-9]{3}|[(][0-9]{3}[)])[ -\.][0-9]{3}[ -\.]+[0-9]{4}/g;
    var reg_e = /([a-z0-9_.-]+[@]+[.a-z09]+)/g;
    var reg_w = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/g;

    //Parse JSON
    for(var l in json.regions){
    	for(var w in json.regions[l].lines){
    			var isDateLine = false
    			for(var t in json.regions[l].lines[w].words){
    				target = json.regions[l].lines[w].words[t].text

    				//Set the type of Picture
    				if(dict.months.includes(target.toLowerCase())){
    					isDateLine = true
    					type = "event"
    				}
    				//Add to dates if dates has been specify before
    				if(isDateLine){
    					dates.push(target)
    				} else if(target.length >= 3 || dict.keeper.includes(target.toLowerCase()) || num.includes(target)){
    					temp_table.push(target)
    				}
    			}
    			W_Array.push(temp_table)
    			H_Array.push(parseInt(json.regions[l].lines[w].boundingBox.split(',')[3])) //Split String
    			temp_table = []
    	}
    }

    //Fonction to find the highest Height
    var i = H_Array.indexOf(Math.max(...H_Array));

    while (1) {
      if (W_Array[i].length > 0 && dict.months.includes(W_Array[i][0].toLowerCase())) {
          H_Array[i] = -1;
    	    i = H_Array.indexOf(Math.max(...H_Array));
      } else {
          break;
      }
    }

    var object = {};
    object.name = W_Array[i].join(" ");
    if (type == "event") {
        object.description = "";
        object.time = "";
    } else {
        object.company = "";
        object.phones = "";
        object.email = "";
        object.address = "";
        object.website = "";
        object.description = "";
    }

    var responseText = "Your contact " + W_Array[i].join(" ") + " has been saved with the following information : ";
    var action = "saveContact";
    if(type == "event"){
      responseText = "I will remind you of " + W_Array[i].join(" ");
    	responseText += " on " + dates.join(" ") + " ! :)";

      object.time = dates.join(" ");

      action = "saveEvent";
    }
    for(var l in W_Array){
    	var x = W_Array[l].join(" ");
    	if(x.match(reg_t)){
    		responseText += "\n\nTelephone : " + x.match(reg_t).toString();
        object.phones += "\n\n" + x.match(reg_t).toString();
    	}
    	else if(x.match(reg_e)){
    		responseText += "\n\nEmail : " + x.match(reg_e).toString();
        object.email += "\n\n" + x.match(reg_e).toString();
    	}
    	else if(x.match(reg_w)){
    		responseText += "\n\nWebsite : " + x.match(reg_w).toString();
        object.website += "\n\n" + x.match(reg_w).toString();
    	}
    	else if(l == i){
    		//Do nothing
    	}
    	else{
    		responseText += "\n\n" + x;
        object.description += "\n\n" + x;
    	}

    }

    session.send(responseText);

    setTimeout(function() {accessDatabase(session, action, object)}, 3000);


}


var LOG = function LOG(msg, type){
    try{
        var html = "<pre>"+JSON.stringify(msg, null, 2)+"</pre>";
        var time = new Date().toISOString();
        if(type === 'in'){
            html = '<span class="label label-info"><<<< Incoming (' + time + ')</span>' + html;
        } else {
            html = '<span class="label label-primary">>>>> Outgoing (' + time + ')</span>' + html;
        }
    }
    catch(err){

    }

}


var dLog = function dLog(msg, logger, failure){
    var html = '<pre>'+msg+'</pre>';
    var time = new Date().toISOString();
    if(failure){
        html = '<span class="label label-danger">Error ('+time+')</span>' + html;
    } else {
        html = '<span class="label label-success">Success ('+time+')</span>' + html;
    }
    logger.prepend(html);
};


function createOptions(overrides) {
    var options = Object.assign(overrides, defaultOptions);
    options.appId = APP_ID;
    options.appKey = APP_KEY;
    options.userId = USER_ID;
    options.url = URL;
    options.tag = NLU_TAG;
    return options;
}

// Text NLU

function textNlu(session, msg){
    var options = createOptions({
        text: msg,
        tag: NLU_TAG,
        language: ASR_LANGUAGE
    });
    startTextNLU(session, options);
}

    var _ttsTransactionId = 0;
    var _asrTransactionId = 1;
    var _nluTransactionId = 2;
    var _asrRequestId = 0;

    var _audioSource = undefined;
    var _audioSink = undefined;

    var _serviceUri = undefined;

function startTextNLU(session, options){
        options = options || {};
        var _options = Object.assign({}, options);
        _options.onopen = function() {
            options.onopen();
            var _tId = (_nluTransactionId + _asrTransactionId + _ttsTransactionId);
            _nluTransactionId += 1;

            var _query_begin = {
                'message': 'query_begin',
                'transaction_id': _tId,

                'command': 'NDSP_APP_CMD',
                'language': options.language || 'eng-USA',
                'context_tag': options.tag
            };

            var _query_parameter = {
                'message': 'query_parameter',
                'transaction_id': _tId,

                'parameter_name': 'REQUEST_INFO',
                'parameter_type': 'dictionary',

                'dictionary': {
                    'application_data': {
                        'text_input': options.text
                    }
                }
            };

            var _query_end = {
                'message': 'query_end',
                'transaction_id': _tId
            };

            _sendJSON(_query_begin);
            _sendJSON(_query_parameter);
            _sendJSON(_query_end);
        };
        connect(session, _options);
    };

    var connect = function connect(session, options) {
        options = options || {};
        _serviceUri = _url(options);

        if(_ws !== undefined) {
            return;
        }

        _ws = new WebSocket(_serviceUri);

        _ws.onopen = function(){
            var deviceId = [
                "Google Chrome",
                "Apple",
                "en"
            ].join('_').replace(/\s/g,'');

            _sendJSON({
                'message': 'connect',
                'user_id': options.userId,
                'codec': options.codec || 'audio/x-speex;mode=wb',
                'device_id': deviceId,
                'phone_model': 'nuance_internal_mixjsapp',
                'phone_number': options.userId
            });

            options.onopen();
        };
        _ws.onmessage = function(msg) {
            var msgType = typeof(msg.data);
            switch (msgType) {
                case 'object':
                    _audioSink.enqueue(msg.data);
                    break;
                case 'string':
                    var msg = JSON.parse(msg.data);
                    if(msg.message == "volume") {
                       options.onvolume(msg.volume);
                    } else {
                       options.onresult(session, msg);
                    }
                    if(msg.message == "audio_begin") {
                        _audioSink.start();
                    }
                    if(msg.message == "audio_end") {
                        _audioSink.play();
                    }
                    if(msg.message == "query_end") {
                        disconnect();
                    }
                    break;
                default:
                    options.onresult(msg.data);
            }
        };

        _ws.binaryType = 'arraybuffer';
        _ws.onclose = options.onclose;
        _ws.onerror = options.onerror;


    };

    var disconnect =  function disconnect(){
        _sendJSON({
            'message': 'disconnect'
        });
        _ws = undefined;
    };

    var _sendJSON = function _sendJSON(json) {
        _ws.send(JSON.stringify(json));
        if(Nuance.logger){
            N.logger.log(json);
        }
    };

    var _url = function _url(options){
        var serviceUri = options.url || N.DEFAULT_URL;
        var params = [];
        params.push('app_id=' + options.appId);
        params.push('algorithm=key');
        params.push('app_key=' + options.appKey);
        serviceUri += params.join('&');
        return serviceUri;
    };
