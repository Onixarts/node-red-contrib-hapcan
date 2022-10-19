 module.exports = function(RED) {

    function ButtonOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.leds = config.leds;
        node.defaultAction = config.defaultAction;
        
        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.statusReceived = function(data)
        {
            node.status(data)
        }

        node.on('input', function(msg, send, done) {
            
            var control = { 
                leds: this.leds,
                action: Number(node.defaultAction)
            }

            if(msg.topic === "control" )
            {
                if(typeof msg.payload === 'object')
                {
                    if( msg.payload.hasOwnProperty('action'))
                    {
                        if(!parseAction(msg.payload.action, control, done))
                            return;
                    }
                    if( msg.payload.hasOwnProperty('leds'))
                    {
                        control.leds.forEach(element => {
                            element.checked = false
                        });
                        
                        if(Array.isArray(msg.payload.leds))
                        {
                            for(var i = 0; i < msg.payload.leds.length; i++)
                            {
                                if(i === 14)
                                    break;

                                if(typeof msg.payload.leds[i] === 'number'){
                                    if(!isLedValid(msg.payload.leds[i]))
                                        continue;
                                    control.leds[msg.payload.leds[i]-1].checked = true;
                                }
                                else if(typeof msg.payload.leds[i] === 'string'){
                                    control.leds.forEach(element => {
                                        if( element.name.toUpperCase() === msg.payload.leds[i].toUpperCase() )
                                            element.checked = true;
                                    });
                                    
                                }
                            }
                        }
                        else
                        {
                            done('Invalid leds element type: '+ typeof msg.payload.leds); 
                            return;
                        }
                    }
                }
                else
                {
                    if(!parseAction(msg.payload, control, done))
                        return;
                }
            }

            if( control.action === -1 ){
                done()
                return;
            }
            if( control.leds.length !== 14 ){
                done()
                return;
            }

            var hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xF0,0xF0, 0xFF,0x00, node.node,node.group, 0x00,0xFF,0xFF,0xFF,0xFF,0xA5]);
            
            hapcanMsg[5] = control.action;
            
            for(var i = 0; i < 8; i++){
                if( control.leds[i].checked )
                    hapcanMsg[6] |= (1 << i);
            }
            for(var i = 8; i < 14; i++){
                if( control.leds[i].checked )
                    hapcanMsg[9] |= (1 << (i-8));
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

        function isLedValid(led)
        {
            var isValid = (led >= 1 && led <= 14);
            if(!isValid)
                node.error('Invalid led number: '+ led);
            return isValid;
        }

        function parseAction(value, control, done)
        {
            if(typeof value === "string" )
            {
                switch(value.toUpperCase())
                {
                    case "OFF": control.action = 0x00; break;
                    case "ON": control.action = 0x01; break;
                    case "TOGGLE": control.action = 0x02; break;
                    default:
                    done('Invalid action string: '+ value);
                    return false;
                }
            }
            else if(typeof value === 'number')
            {
                if(value < 0 || value > 2)
                {
                    done('Invalid action number value: '+ value);
                    return false;
                }
                control.action = value;
            }
            else if(typeof value === 'boolean')
            {
                control.action = value != false ? 0x01 : 0x00;
            }
            return true;
        }

    }
    RED.nodes.registerType("button-output",ButtonOutputNode);


    function ButtonInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
		node.channelFilter = config.channelFilter;
        
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

            if((node.channelFilter & (1 << (hapcanMessage.frame[7] - 1))) === 0)
                return;

            switch (hapcanMessage.frame[8]){
                case 0x00: hapcanMessage.state = "OPEN";break;
                case 0x01: hapcanMessage.state = "DISABLED"; break;
				case 0xFF: hapcanMessage.state = "CLOSED";break;
				case 0xFE: hapcanMessage.state = "HELD_400ms";break;
				case 0xFD: hapcanMessage.state = "HELD_4s";break;
				case 0xFC: hapcanMessage.state = "RELEASED_BEFORE_400ms";break;
				case 0xFB: hapcanMessage.state = "RELEASED_AFTER_400ms";break;
                case 0xFA: hapcanMessage.state = "RELEASED_AFTER_4s";break;
                case 0xF1: hapcanMessage.state = "HELD_1s";break;
                case 0xFA: hapcanMessage.state = "RELEASED_AFTER_1s";break;
                default: 
                    node.warn('Button state value unknown:' + hapcanMessage.frame[8]);
                    hapcanMessage.state = 'undefined';
				
            }
            
            hapcanMessage.channel = hapcanMessage.frame[7];
            let {deviceName, channelName} = node.gateway.getDeviceInfo(hapcanMessage.node, hapcanMessage.group, hapcanMessage.channel)
            hapcanMessage.channelName = channelName
            hapcanMessage.deviceName = deviceName

            switch( hapcanMessage.frame[9] )
            {
                case 0x00 : hapcanMessage.led = 'OFF'; break;
                case 0x01 : hapcanMessage.led = 'DISABLED'; break;
                case 0xFF : hapcanMessage.led = 'ON'; break;
                default:
                    node.warn('Led value unknown:' + hapcanMessage.frame[9]);
                    hapcanMessage.led = 'undefined';
            }

            node.send({topic: 'Button message', payload: hapcanMessage});
        }

        node.gateway.eventEmitter.on('messageReceived_301', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived_301', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });

    }
    RED.nodes.registerType("button-input",ButtonInputNode);
}