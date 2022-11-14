 module.exports = function(RED) {

    function TempInputNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;
        
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
            
            hapcanMessage.type = hapcanMessage.frame[7];

            if( hapcanMessage.type !== 0x11 && hapcanMessage.type !== 0x01)
                return;

            let {deviceName, channelName} = node.gateway.getDeviceInfo(hapcanMessage.node, hapcanMessage.group, 'temperature', 1)
            hapcanMessage.channelName = channelName
            hapcanMessage.deviceName = deviceName

            hapcanMessage.temp = Number(Number(((hapcanMessage.frame[8] * 256) + hapcanMessage.frame[9]) * 0.0625).toFixed(1));
            hapcanMessage.setpoint = Number(Number(((hapcanMessage.frame[10] * 256) + hapcanMessage.frame[11]) * 0.0625).toFixed(2));
            hapcanMessage.hysteresis = Number(Number(hapcanMessage.frame[12] * 0.0625).toFixed(4));

            node.send({topic: 'Temperature sensor message', payload: hapcanMessage});
        }

        node.gateway.eventEmitter.on('messageReceived_304', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived_304', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });        

    }
    RED.nodes.registerType("temp-input",TempInputNode);
}
