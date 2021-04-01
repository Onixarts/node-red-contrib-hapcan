module.exports = function (RED) {

    function ThermostatInputNode(config) {
        RED.nodes.createNode(this, config);
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

            if (hapcanMessage.node != node.node || hapcanMessage.group != node.group)
                return;

            hapcanMessage.type = hapcanMessage.frame[7];

            if (hapcanMessage.type != 0x12)
                return;

            switch (hapcanMessage.frame[8]) {
                case 0x00:
                    hapcanMessage.position = 'BELOW';
                    break;
                case 0x80:
                    hapcanMessage.position = 'POWERUP';
                    break;
                case 0xFF:
                    hapcanMessage.position = 'ABOVE';
                    break;
            }

            switch (hapcanMessage.frame[9]) {
                case 0xFF:
                    hapcanMessage.enabled = true;
                    break;
                case 0x00:
                    hapcanMessage.enabled = false;
                    break;
            }

            node.send({ topic: 'Thermostat message', payload: hapcanMessage });
        }

        node.gateway.eventEmitter.on('messageReceived_304', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)        

        this.on('close', function() {
            node.gateway.eventEmitter.removeListener('messageReceived_304', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });

    }
    RED.nodes.registerType("thermostat-input", ThermostatInputNode);
}
