module.exports = function (RED) {
   "use strict";
    var reconnectTime = RED.settings.socketReconnectTime || 10000;
    var socketTimeout = RED.settings.socketTimeout || null;
    var net = require('net');
    var events = require('events');

    var ConnectionStatus = Object.freeze(
        {
            notConnected: { value: 0, name: "not connected"}, 
            connecting: {value: 1, name: "connecting"},
            connected: {value: 2, name: "connected"},
            closing: {value: 5, name: "closing"}
    });

    // var connectionPool = {};

    function HapcanGatewayNode(n) {
        RED.nodes.createNode(this, n);
        this.host = n.host;
        this.port = n.port;
        this.group = n.group;
        this.node = n.node;
        this.client = null;
        this.incommingMessage = Buffer.allocUnsafe(15);
        this.incommingMessage.fill(0xFF);
        this.incommingMessageIndex = 0;
        this.eventEmitter = new events.EventEmitter();

        this.connectionStatus = ConnectionStatus.notConnected;
        
        // register hapcan nodes that uses the gateway
        var node = this;
        this.clientNodes = {};

        node.setConnectionStatus = function(connectionStatus)
        {
            node.log(connectionStatus.name);
            node.connectionStatus = connectionStatus;

            var status =  {};
            switch(node.connectionStatus.value)
            {
                case ConnectionStatus.notConnected.value:
                    status = {fill:"red",shape:"dot",text:"Not connected"};
                    break;
                case ConnectionStatus.connecting.value:
                    status = {fill:"yellow",shape:"dot",text:"Connecting"};
                    break;
                case ConnectionStatus.connected.value:
                    status = {fill:"green",shape:"dot",text:"Connected"};
                    break;
            }
            node.status(status);
            for(var hapcanId in node.clientNodes)
            {
                node.clientNodes[hapcanId].status(status);
            }
        };

        node.setConnectionStatus(ConnectionStatus.notConnected);

        this.register = function(hapcanNode) {
            
            var existingNode = false;
            var index = 1;
            var instanceSeparator = hapcanNode.hapcanId.indexOf('_');
            var hapcanRootId = "";
            var hapcanId = "";
            if(instanceSeparator > -1)
            {
                hapcanRootId = hapcanNode.hapcanId.substring(0, instanceSeparator);
            }
            else
            {
                node.error("Missing '_' in HapcanId. Node not registered.");
                return;
            }
            
            do
            {
                hapcanId = hapcanRootId+'_'+index;
                existingNode = node.clientNodes.hasOwnProperty(hapcanId);
                index++;
            } while(existingNode);

            hapcanNode.hapcanId = hapcanId;
            node.log("client registering: " + hapcanNode.hapcanId);
            node.clientNodes[hapcanId] = hapcanNode;
            if (Object.keys(node.clientNodes).length === 1) {
                node.connect();
            }
        };

        this.deregister = function (hapcanNode, done) {
            node.log("client unregister: "+ hapcanNode.hapcanId);
            delete node.clientNodes[hapcanNode.hapcanId];
            if (node.connectionStatus.value === ConnectionStatus.closing.value) {
                return done();
            }
            // if (Object.keys(node.clientNodes).length === 0) {
            //     if (node.client && node.client.connected) {
            //         return node.client.end(done);
            //     } else {
            //         node.client.end();
            //         return done();
            //     }
            // }
            done();
        };



        this.connect = function (){

            if(node.connectionStatus.value === ConnectionStatus.notConnected.value)
            {
                node.setConnectionStatus(ConnectionStatus.connecting);
                
                node.client = net.createConnection(node.port, node.host, function(){
                    node.setConnectionStatus(ConnectionStatus.connected);

                });
                node.client.on('error', function(err){
                    node.log('error during connection occured: ' + err);
                });

                node.client.on('close', function(){
                    node.setConnectionStatus(ConnectionStatus.notConnected);
                });

                node.client.on('data', function(data){
                    
                    for(var i = 0; i < data.length; i++)
                    {
                        node.incommingMessage[node.incommingMessageIndex] = data[i];
                        node.incommingMessageIndex++;
                        if(node.incommingMessageIndex === 15)
                        {
                            if(node.incommingMessage[0] === 0xAA && node.incommingMessage[14]=== 0xA5)
                                node.messageReceived(node.incommingMessage);
                            else
                                node.warn('Invalid frame received:' + node.messageToString(node.incommingMessage));
                            node.incommingMessage.fill(0xFF);
                            node.incommingMessageIndex = 0;
                        }
                    }
                });
            }

        };

        this.messageToString = function(hapcanMessage)
        {
            var messageString = '';
            for(var i = 0; i < hapcanMessage.length; i++)
                messageString+= ' ' + ("0" + hapcanMessage[i].toString(16).toUpperCase()).slice (-2);
            return messageString;
        }

        function HapcanMessage(frame)
        {
            this.frame = frame;
            this.type =  Number((((frame[1]) * 256 + (frame[2] & 0xF0)) / 16).toString(16));
            this.isAnswer = (frame[2] & 0x01) === 0 ? false : true;
            this.node = frame[3];
            this.group = frame[4];
        }

        this.messageReceived = function(frame)
        {
            node.log('received: << ' + node.messageToString(frame));

            var hapcanMsg = new HapcanMessage(frame);

            var eventArgs = { payload: hapcanMsg, topic: 'Hapcan Message' };
            node.eventEmitter.emit('messageReceived_'+hapcanMsg.type, eventArgs);
        }

        this.send = function(msg){
            if (node.connectionStatus.value === ConnectionStatus.connected.value ) {
                if (msg.payload === null || msg.payload === undefined) {
                    msg.payload = "";
                } 
                else if (Buffer.isBuffer(msg.payload)) {

                    var sum = 0;
                    for (var i = 1; i < 13; i++)
                    {
                        sum += msg.payload[i];
                    }
                    msg.payload[13] = sum;
                    
                    this.log('sending:  >> '+ node.messageToString(msg.payload));

                    node.client.write(msg.payload);
                }
            }
        };
    }
    RED.nodes.registerType("hapcan-gateway", HapcanGatewayNode);
}