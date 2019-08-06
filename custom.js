module.exports = function(RED) {
    function CustomMessageOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.compGroup = Number(config.group);
        node.compNode = Number(config.node);
        node.name = config.name;
        node.frameType = Number(config.frameType)
        node.d0name = config.d0name
        node.d1name = config.d1name
        node.d2name = config.d2name
        node.d3name = config.d3name
        node.d4name = config.d4name
        node.d5name = config.d5name
        node.d6name = config.d6name
        node.d7name = config.d7name
        node.d0value = Number(config.d0value)
        node.d1value = Number(config.d1value)
        node.d2value = Number(config.d2value)
        node.d3value = Number(config.d3value)
        node.d4value = Number(config.d4value)
        node.d5value = Number(config.d5value)
        node.d6value = Number(config.d6value)
        node.d7value = Number(config.d7value)

        node.hapcanId = ("00" + node.node).slice (-3) + ("00" + node.group).slice (-3) + ("00" + node.channel).slice (-3)+'_';

        this.status({fill: "grey", shape: "dot", text: "not registered to gateway"});

        if(node.gateway)
        {
            node.gateway.register(node);
        }
        else
        {
            node.error('Invalid configuration. Gateway is required.'); 
        }

        this.on('close', function(done) {
            if (node.gateway) {
                node.gateway.deregister(node,done);
            }
        });

        node.on('input', function(msg) {

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
            
            // if(msg.topic === "control" )
            // {
            //     if(typeof msg.payload === 'object')
            //     {
            //         if( msg.payload.hasOwnProperty('action'))
            //         {
            //             if(!parseAction(msg.payload.action, control))
            //                 return;
            //         }
            //         if( msg.payload.hasOwnProperty('channels'))
            //         {
            //             control.channels = 0;
            //             if(typeof msg.payload.channels === 'number')
            //             {
            //                 if(!isChannelValid(msg.payload.channels))
            //                     return;
            //                 control.channels = 0x01 << (msg.payload.channels -1);
            //             }
            //             else if(Array.isArray(msg.payload.channels))
            //             {
            //                 for(var i = 0; i < msg.payload.channels.length; i++)
            //                 {
            //                     if(!isChannelValid(msg.payload.channels[i]))
            //                         return;
            //                     control.channels |= 0x01 << (msg.payload.channels[i] - 1);
            //                 }
            //             }
            //             else
            //             {
            //                 node.error('Invalid channels type: '+ typeof msg.payload.channels); 
            //                 return;
            //             }
            //         }
            //     }
            //     else
            //     {
            //         if(!parseAction(msg.payload, control))
            //             return;
            //     }
            // }

            // if( control.action === -1 )
            //     return;
            // if( control.channels === 0 )
            //     return;

            
            
            // if(node.UNIV === 1)
            // {
            //     hapcanMsg[10] = control.action;
            //     hapcanMsg[11] = control.channels;
            //     hapcanMsg[12] = control.delay;   
            // }
            // else
            // {
            //     hapcanMsg[5] = control.action;
            //     hapcanMsg[6] = control.channels;
            //     hapcanMsg[9] = control.delay;
            // }

            msg.payload = hapcanMsg;
            msg.topic = 'control';
            node.gateway.send(msg);
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
        node.frameTypeFilter = Number(config.frameTypeFilter);
        node.d0name = config.d0name;
        node.d1name = config.d1name;
        node.d2name = config.d2name;
        node.d3name = config.d3name;
        node.d4name = config.d4name;
        node.d5name = config.d5name;
        node.d6name = config.d6name;
        node.d7name = config.d7name;

        node.hapcanId = ("00" + node.node).slice (-3) + ("00" + node.group).slice (-3) + '_';

        this.status({fill: "grey", shape: "dot", text: "not registered to gateway"});

        if(node.gateway)
        {
            node.gateway.register(node);
        }
        else
        {
            node.error('Invalid configuration. Gateway is required.'); 
        }

        this.on('close', function(done) {
            if (node.gateway) {
                node.gateway.deregister(node,done);
            }
        });

        node.gateway.eventEmitter.on('messageReceived', function(data){
            
            var hapcanMessage = data.payload;

            if(hapcanMessage.node != node.node || hapcanMessage.group != node.group )
                return;

            console.log(node.frameTypeFilter)
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

            node.send({topic: 'Custom message', payload: hapcanMessage});
        });
    }
    RED.nodes.registerType("custom-input",CustomMessageInputNode);
}