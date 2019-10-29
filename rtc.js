 module.exports = function(RED) {
    function RTCOutputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        node.defaultAction = config.defaultAction;

        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.gateway.eventEmitter.on('statusChanged', function(data){
            node.status(data)
        })

        this.number2bcd = (value) => ( ((Math.floor(value/10)& 0x0F)<<4) + ((value%10) & 0x0F));
        
        node.on('input', function(msg) {
            
            var control = { 
                action: Number(node.defaultAction),
                datetime: new Date()
            }

            if(msg.topic === "control" )
            {
                if(typeof msg.payload === 'number')
                {
                    control.datetime.setTime(msg.payload);
                    control.action = 2;
                }
                else
                    return;
            }
            if( control.action === -1 )
                return;
            
            //set time
            if( control.action === 0 || control.action === 2)
            {
                //buffer is 13 bytes long for ethernet module control.
                let hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xFF,0xFF, 0xFF,0xFF, 0xFF, 0xFF, 0xFF,0xFF,0xFF,0xA5]);
                
                hapcanMsg[3] = 0x00;
                hapcanMsg[4] = node.number2bcd(control.datetime.getHours());
                hapcanMsg[5] = node.number2bcd(control.datetime.getMinutes());
                hapcanMsg[6] = node.number2bcd(control.datetime.getSeconds());

                msg.payload = hapcanMsg;
                msg.topic = 'control';
                node.gateway.send(msg);
            }

            const dayArray = ['','monday','tuesday','wednesday','thurday','friday','saturday','sunday'];
            //set date
            if( control.action === 1 || control.action === 2)
            {
                //buffer is 13 bytes long for ethernet module control.
                var hapcanMsg = Buffer.from([0xAA, 0x10,0xA0, 0xFF,0xFF, 0xFF,0xFF, 0xFF, 0xFF, 0xFF,0xFF,0xFF,0xA5]);
                
                hapcanMsg[3] = 0x01;
                hapcanMsg[4] = node.number2bcd(control.datetime.getFullYear()-2000);
                hapcanMsg[5] = node.number2bcd(control.datetime.getMonth()+1);
                hapcanMsg[6] = node.number2bcd(control.datetime.getDate());
                hapcanMsg[7] = node.number2bcd(control.datetime.getDay());

                msg.payload = hapcanMsg;
                msg.topic = 'control';
                node.gateway.send(msg);
            }
        });
        this.on('close', function() {
            // tidy up any state
        });
    }
    RED.nodes.registerType("rtc-output",RTCOutputNode);

    function RTCInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        
        this.status({fill: "grey", shape: "dot", text: "not connected"});

        node.gateway.eventEmitter.on('statusChanged', function(data){
            node.status(data)
        })

        this.bcd2number = function(value)
        {
            return ((((value & 0xF0) >> 4) * 10) + (value & 0x0F));
        }

        node.gateway.eventEmitter.on('messageReceived_300', function(data){
            
            var hapcanMessage = data.payload;

            if(hapcanMessage.node != node.node || hapcanMessage.group != node.group )
                return;
            
            const dayArray = ['','monday','tuesday','wednesday','thurday','friday','saturday','sunday'];

            hapcanMessage.year = 2000+node.bcd2number( hapcanMessage.frame[6]);
            hapcanMessage.month = node.bcd2number( hapcanMessage.frame[7]);
            hapcanMessage.date = node.bcd2number( hapcanMessage.frame[8]);
            hapcanMessage.day = hapcanMessage.frame[9];
            if( hapcanMessage.day > 0 && hapcanMessage.day < 8 )
                hapcanMessage.dayString = dayArray[hapcanMessage.day];
            else
                hapcanMessage.dayString = '';
            hapcanMessage.hour = node.bcd2number( hapcanMessage.frame[10]);
            hapcanMessage.min = node.bcd2number( hapcanMessage.frame[11]);
            hapcanMessage.sec = node.bcd2number( hapcanMessage.frame[12]);

            node.send({topic: 'RTC message', payload: hapcanMessage});
        });

        this.on('close', function() {
            // tidy up any state
        });

    }
    RED.nodes.registerType("rtc-input",RTCInputNode);
}