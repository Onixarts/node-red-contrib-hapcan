module.exports = function (RED) {

    function TempInputNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.gateway = RED.nodes.getNode(config.gateway);
        node.group = config.group;
        node.node = config.node;
        node.name = config.name;

        node.statusReceived = function (data) {
            node.status(data)
        }

        node.messageReceived = function (data) {
            var hapcanMessage = data.payload;

            if (hapcanMessage.node != node.node || hapcanMessage.group != node.group)
                return;

            hapcanMessage.type = hapcanMessage.frame[7];

            if (hapcanMessage.type !== 0x11 && hapcanMessage.type !== 0x01)
                return;

            hapcanMessage.temp = Number(decodeTwosComplement(hapcanMessage.frame[8], hapcanMessage.frame[9]) * 0.0625);
            hapcanMessage.setpoint = Number(decodeTwosComplement(hapcanMessage.frame[10], hapcanMessage.frame[11]) * 0.0625);
            hapcanMessage.hysteresis = Number((hapcanMessage.frame[12] + 1) * 0.0625);

            node.send({ topic: 'Temperature sensor message', payload: hapcanMessage });
        }

        node.gateway.eventEmitter.on('messageReceived_304', node.messageReceived)
        node.gateway.eventEmitter.on('statusChanged', node.statusReceived)

        this.on('close', function () {
            node.gateway.eventEmitter.removeListener('messageReceived_304', node.messageReceived)
            node.gateway.eventEmitter.removeListener('statusChanged', node.statusReceived)
        });

    }

    function decodeTwosComplement(msb, lsb) {
        const value = (msb << 8) | lsb;
        if (value & 0x8000) {
            return -Number((~value & 0x7FFF) + 1);
        }
        return Number(value);
    }

    RED.nodes.registerType("temp-input", TempInputNode);
}
