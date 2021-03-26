 module.exports = function(RED) {

    function TempInputNode(config) {
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

        node.gateway.eventEmitter.on('messageReceived_304', function(data){
            
            var hapcanMessage = data.payload;

            if(hapcanMessage.node != node.node || hapcanMessage.group != node.group )
                return;
            
            hapcanMessage.type = hapcanMessage.frame[7];

            if( hapcanMessage.type !== 0x11 && hapcanMessage.type !== 0x01)
                return;

            hapcanMessage.temp = Number(Number(((hapcanMessage.frame[8] * 256) + hapcanMessage.frame[9]) * 0.0625).toFixed(1));
            hapcanMessage.setpoint = Number(Number(((hapcanMessage.frame[10] * 256) + hapcanMessage.frame[11]) * 0.0625).toFixed(2));
            hapcanMessage.hysteresis = Number(Number(hapcanMessage.frame[12] * 0.0625).toFixed(4));

            node.send({topic: 'Temperature sensor message', payload: hapcanMessage});
        });

        this.on('close', function() {
            // tidy up any state
        });

    }
    RED.nodes.registerType("temp-input",TempInputNode);
}
