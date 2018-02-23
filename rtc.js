 module.exports = function(RED) {

    function RTCInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        
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

            data.topic = 'RTC message';

            node.send(data);
        });

        this.on('close', function() {
            // tidy up any state
        });

    }
    RED.nodes.registerType("rtc-input",RTCInputNode);
}