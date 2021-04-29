module.exports = function(RED) {
    function DimmerOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.state = config.state;
        node.speed = config.speed;
        node.UNIV = Number(config.UNIV);
        if( node.UNIV == undefined)
            node.UNIV = 3;   
        
        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.statusReceived = function(data)
        {
            node.status(data)
        }

        node.on('input', function(msg, send, done) {
            
            var control = { 
                state: Number(node.state),
                speed: Number(node.speed),
                delay: 0x00,

                command: 0xFF,
                sendSpeedMessage: true,
            }

            if(msg.topic === "control" )
            {
                if(typeof msg.payload === 'object')
                {
                    if( msg.payload.hasOwnProperty('speed'))
                    {
                        if(typeof msg.payload.speed === 'number')
                        {
                            if(msg.payload.speed < 0)
                                control.speed = 0;
                            else if(msg.payload.speed > 255)
                                control.speed = 255;
                            else
                                control.speed = msg.payload.speed;
                        }
                        else
                        {
                            done('Invalid speed type: '+ typeof msg.payload.speed); 
                            return;
                        }
                    }

                    if( msg.payload.hasOwnProperty('state'))
                    {
                        if(!parseAction(msg.payload.state, control, done))
                            return;
                    }                        
                }
                else
                {
                    if(!parseAction(msg.payload, control, done))
                        return;
                }
            }

            if( control.sendSpeedMessage)
                control.sendSpeedMessage = control.speed > 0;

            if( control.sendSpeedMessage)
            {   
                let command = 0x09;
                if( node.UNIV === 1)
                {
                    control.speed = Math.round((control.speed / 5));
                    if( control.speed > 0x0C )
                        control.speed = 0x0C;
                }
                let hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF, 0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]); 
                
                hapcanMsg[5] = command;
                hapcanMsg[6] = control.speed-1;

                msg.payload = hapcanMsg;
                msg.topic = 'control';
                node.gateway.send(msg);
            }
            
            if( control.command === 0xFF)
            {
                //speed determines if channel will be switch instantly or softly
                if(control.speed === 0)
                    control.command = 0x00;
                else
                    control.command = 0x06;
            }

            var hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF,0xFF, node.node,node.group, 0xFF,0xFF,0xFF,0xFF,0xFF,0xA5]);
            
            if(node.UNIV === 1)
            {
                hapcanMsg[10] = control.command;
                hapcanMsg[11] = control.state;
                hapcanMsg[12] = control.delay;
            }
            else
            {
                hapcanMsg[5] = control.command;
                hapcanMsg[6] = control.state;
                hapcanMsg[9] = control.delay;
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

        function parseAction(value, control, done)
        {
            if(typeof value === "string" )
            {
                switch(value.toUpperCase())
                {
                    case "OFF": control.state = 0x00; 
                                break;
                    case "ON":  control.state = 0xFF; 
                                break;
                    case "TOGGLE": 
                                if( control.speed === 0)
                                {
                                    control.command = 0x01;
                                    control.sendSpeedMessage = false;
                                }
                                else 
                                    control.command = 0x05;
                                break;
                    case "STOP":
                                control.command = 0x04;
                                control.sendSpeedMessage = false;
                                break;                                
                    default:
                        done('Invalid action string: '+ value);
                    return false;
                }
            }
            else if(typeof value === 'number')
            {
                if(value < 0 || value > 255)
                {
                    done('Invalid state number value: '+ value);
                    return false;
                }
                control.state = value;
            }
            else if(typeof value === 'boolean')
            {
                control.state = value != false ? 0xFF : 0x00;
            }
            return true;
        }

    }
    RED.nodes.registerType("dimmer-output", DimmerOutputNode);

    function DimmerInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.userFieldStateON = config.userFieldStateON;
        node.userFieldStateOFF = config.userFieldStateOFF;
        
        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.statusReceived = function(data)
        {
            node.status(data)
        }

        node.messageReceived = function(data)
        {            
            var hapcanMessage = data.payload;

            if(hapcanMessage.node != node.node || hapcanMessage.group != node.group )
                return;

            hapcanMessage.type = hapcanMessage.frame[7];

            if (hapcanMessage.type != 0x01)
                return;

            hapcanMessage.status = hapcanMessage.frame[8];
            hapcanMessage.enabled = hapcanMessage.frame[8] === 0x00 ? false : true;
            hapcanMessage.channel = hapcanMessage.frame[7]; //always 1
            hapcanMessage.userField = hapcanMessage.enabled ? node.userFieldStateON : node.userFieldStateOFF;

            node.send({topic: 'Dimmer message', payload: hapcanMessage});
        }

        node.gateway.eventEmitter.on('messageReceived_306', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived_306', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });

    }
    RED.nodes.registerType("dimmer-input",DimmerInputNode);
}