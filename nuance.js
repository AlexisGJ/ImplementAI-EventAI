   /*
    * This sample is provided to help developers to write their own NCS access
    * libraries. This shows how to construct websockets messages/frames
    * containing NCS (Nuance Cloud Services) commands and arguments.
    * This example supports three types of requests:
    * 1. Text to Speech (TTS)
    * 2. Automatic Speech Recognition (ASR)
    * 3. Natural Language Processing (NLU)
    */

'use strict';

(function(root, factory){
    root.Nuance = factory(root, {});
}(this, function(root, N){


    var _ws = undefined;
    var _ttsTransactionId = 0;
    var _asrTransactionId = 1;
    var _nluTransactionId = 2;
    var _audioSink = undefined;

    var _serviceUri = undefined;


    var connect = function connect(options) {
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
                       options.onresult(msg);
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

    

    /**
     *
     * @param options
     * - text
     * - tag
     * - language
     * - onopen
     * - onclose
     * - onresult
     */
    N.startTextNLU = function startTextNLU(options){
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
        connect(_options);
    };


    




    //Data Helpers

    var _sendJSON = function _sendJSON(json) {
        _ws.send(JSON.stringify(json));
        if(N.logger){
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

    return N;

}));
