module.exports = function (RED) {
   "use strict";
    var reconnectTime = RED.settings.socketReconnectTime || 10000;
    var socketTimeout = RED.settings.socketTimeout || null;
    var net = require('net');

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

        this.connectionStatus = ConnectionStatus.notConnected;
        
        // register hapcan nodes that uses the gateway
        var node = this;
        this.clientNodes = {};
        this.receivingNodes = {};

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
                //node.log(hapcanId);
                node.clientNodes[hapcanId].status(status);
            }
            for(var hapcanId in node.receivingNodes)
            {
                //node.log(hapcanId);
                node.receivingNodes[hapcanId].status(status);
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
                node.log("Missing '_' in HapcanId. Node not registered.");
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
                    node.log('>> jakies dane przybyly');

                });
            }

        };

        this.send = function(msg){
            if (node.connectionStatus.value === ConnectionStatus.connected.value ) {
                if (msg.payload === null || msg.payload === undefined) {
                    msg.payload = "";
                } 
                else if (Buffer.isBuffer(msg.payload)) {

                    var sum = 0;
                    var messageString = '';
                    for (var i = 1; i < 13; i++)
                    {
                        messageString+= ' ' + ("0" +msg.payload[i].toString(16).toUpperCase()).slice (-2);
                        sum += msg.payload[i];
                    }
                    msg.payload[13] = sum;
                    messageString+= ' ' + ("0" +msg.payload[13].toString(16).toUpperCase()).slice (-2);
                    
                    this.log('Sending: '+messageString);

                    node.client.write(msg.payload);

                    // if (typeof msg.payload === "object") {
                    //         msg.payload = JSON.stringify(msg.payload);
                    //     } else if (typeof msg.payload !== "string") {
                    //     msg.payload = "" + msg.payload;
                    // }
                }
            }
        };
    }
    RED.nodes.registerType("hapcan-gateway", HapcanGatewayNode);
}