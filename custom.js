module.exports = function(RED) {
    function CustomMessageOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.compGroup = Number(config.group);
        node.compNode = Number(config.node);
        node.name = config.name;
        node.frameType = config.frameType
        node.dataNames = [
            { byte: 5, name: config.d0name },
            { byte: 6, name: config.d1name },
            { byte: 7, name: config.d2name },
            { byte: 8, name: config.d3name },
            { byte: 9, name: config.d4name },
            { byte: 10, name: config.d5name },
            { byte: 11, name: config.d6name },
            { byte: 12, name: config.d7name }
        ]
        
        node.namedDataBytes = node.dataNames.filter(function(current){
            return current.name !== ''
        })

        node.d0value = Number(config.d0value)
        node.d1value = Number(config.d1value)
        node.d2value = Number(config.d2value)
        node.d3value = Number(config.d3value)
        node.d4value = Number(config.d4value)
        node.d5value = Number(config.d5value)
        node.d6value = Number(config.d6value)
        node.d7value = Number(config.d7value)

        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.statusReceived = function(data)
        {
            node.status(data)
        }

        node.on('input', function(msg, send, done) {

            var hapcanMsg = Buffer.from([0xAA, 0xFF,0xFF, node.compNode,node.compGroup, 0xF0,0xF0,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            hapcanMsg[1] = node.frameType >>> 4
            hapcanMsg[2] = (node.frameType & 0x0F) << 4
            hapcanMsg[5] = node.d0value
            hapcanMsg[6] = node.d1value
            hapcanMsg[7] = node.d2value
            hapcanMsg[8] = node.d3value
            hapcanMsg[9] = node.d4value
            hapcanMsg[10] = node.d5value
            hapcanMsg[11] = node.d6value
            hapcanMsg[12] = node.d7value
            
            let messageModified = false

            if(msg.topic === "control" )
            {
                if(typeof msg.payload === 'object')
                {
                    for(let i = 0; i < node.namedDataBytes.length; i++){
                        let namedDataByte = node.namedDataBytes[i]
                        if (msg.payload[namedDataByte.name] !== undefined ){
                            
                            hapcanMsg[namedDataByte.byte] = Math.min(255, Math.max(0, Number(msg.payload[namedDataByte.name]) ) )
                            messageModified = true
                        }
                    }
                }
                // do not send hapcan frame if control message doesn't modiffy the frame
                if(!messageModified){
                    done()
                    return
                }
            }

            msg.payload = hapcanMsg;
            msg.topic = 'control';
            node.gateway.send(msg);
            done()
        });

        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });

    }
    RED.nodes.registerType("custom-output",CustomMessageOutputNode);

    function CustomMessageInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.frameTypeFilter = config.frameTypeFilter;
        node.d0name = config.d0name;
        node.d1name = config.d1name;
        node.d2name = config.d2name;
        node.d3name = config.d3name;
        node.d4name = config.d4name;
        node.d5name = config.d5name;
        node.d6name = config.d6name;
        node.d7name = config.d7name;

        node.hapcanId = ("00" + node.node).slice (-3) + ("00" + node.group).slice (-3) + '_';

        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.statusReceived = function(data)
        {
            node.status(data)
        }

        node.messageReceived = function(data)
        {
            var hapcanMessage = data.payload;

            if( (Number(node.node)!== 0 && hapcanMessage.node != node.node) || (Number(node.group)!== 0 && hapcanMessage.group != node.group) )
                return;

            if(node.frameTypeFilter !== 0){
                if(hapcanMessage.frameType !== node.frameTypeFilter)
                    return;
            }

            if( node.d0name !== '')
                hapcanMessage[node.d0name] = hapcanMessage.frame[5];
            if( node.d1name !== '')
                hapcanMessage[node.d1name] = hapcanMessage.frame[6];                
            if( node.d2name !== '')
                hapcanMessage[node.d2name] = hapcanMessage.frame[7];                
            if( node.d3name !== '')
                hapcanMessage[node.d3name] = hapcanMessage.frame[8];                
            if( node.d4name !== '')
                hapcanMessage[node.d4name] = hapcanMessage.frame[9];                
            if( node.d5name !== '')
                hapcanMessage[node.d5name] = hapcanMessage.frame[10];                
            if( node.d6name !== '')
                hapcanMessage[node.d6name] = hapcanMessage.frame[11];                
            if( node.d7name !== '')
                hapcanMessage[node.d7name] = hapcanMessage.frame[12];    
                
            let {deviceName, channelName} = node.gateway.getDeviceInfo(hapcanMessage.node, hapcanMessage.group, 1) // channel is unknown
            //hapcanMessage.channelName = channelName
            hapcanMessage.deviceName = deviceName

            node.send({topic: 'Hapcan message', payload: hapcanMessage});
        };

        node.gateway.eventEmitter.on('messageReceived', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });
    }
    RED.nodes.registerType("custom-input",CustomMessageInputNode);
}