module.exports = function(RED) {
    function CustomMessageOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        //node.channel = config.channel;
        //node.defaultAction = config.defaultAction;
        //node.UNIV = Number(config.UNIV);
        //if( node.UNIV == undefined)
          //  node.UNIV = 3;

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
            
            // var control = { 
            //     channels: Number(node.channel),
            //     action: Number(node.defaultAction),
            //     delay: 0x00
            // }

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

            //var hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF,0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            
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

            //msg.payload = hapcanMsg;
            //msg.topic = 'control';
            //node.gateway.send(msg);
        });

        // function parseAction(value, control)
        // {
        //     if(typeof value === "string" )
        //     {
        //         switch(value.toUpperCase())
        //         {
        //             case "OFF": control.action = 0x00; break;
        //             case "ON": control.action = 0x01; break;
        //             case "TOGGLE": control.action = 0x02; break;
        //             default:
        //             node.error('Invalid action string: '+ value);
        //             return false;
        //         }
        //     }
        //     else if(typeof value === 'number')
        //     {
        //         if(value < 0 || value > 2)
        //         {
        //             node.error('Invalid action number value: '+ value);
        //             return false;
        //         }
        //         control.action = value;
        //     }
        //     else if(typeof value === 'boolean')
        //     {
        //         control.action = value != false ? 0x01 : 0x00;
        //     }
        //     return true;
        // }

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

        // node.channelFilter = config.channelFilter;
        // node.userFieldStateON = config.userFieldStateON;
        // node.userFieldStateOFF = config.userFieldStateOFF;
        
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

            // if((node.channelFilter & (1 << (hapcanMessage.frame[7] - 1))) === 0)
            //     return;

            // hapcanMessage.state = hapcanMessage.frame[8] === 0x00 ? 'OFF' : 'ON';
            // hapcanMessage.enabled = hapcanMessage.frame[8] === 0x00 ? false : true;
            // hapcanMessage.channel = hapcanMessage.frame[7];
            // hapcanMessage.userField = hapcanMessage.state === 'ON' ? node.userFieldStateON : node.userFieldStateOFF;

            node.send({topic: 'Custom message', payload: hapcanMessage});
        });


        // function parseAction(value, control)
        // {
        //     if(typeof value === "string" )
        //     {
        //         switch(value.toUpperCase())
        //         {
        //             case "OFF": control.action = 0x00; break;
        //             case "ON": control.action = 0x01; break;
        //             case "TOGGLE": control.action = 0x02; break;
        //             default:
        //             node.error('Invalid action string: '+ value);
        //             return false;
        //         }
        //     }
        //     else if(typeof value === 'number')
        //     {
        //         if(value < 0 || value > 2)
        //         {
        //             node.error('Invalid action number value: '+ value);
        //             return false;
        //         }
        //         control.action = value;
        //     }
        //     return true;
        // }

    }
    RED.nodes.registerType("custom-input",CustomMessageInputNode);
}