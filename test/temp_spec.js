//const should = require("should");
const sinon = require('sinon');
const { assert } = require("chai");
const EventEmitter = require('events').EventEmitter;
const helper = require("node-red-node-test-helper");
const temperatureNode = require("../temp.js");
const gatewayNode = require("../hapcan-gateway.js");
const inputHelperNode = require("./input-helper.js");

const hapcanNodes = [gatewayNode, temperatureNode, inputHelperNode];

helper.init(require.resolve('node-red'));

describe('HAPCAN Temperature Node', function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    const flow = [
        { id: "g1", type: "hapcan-gateway", name: "gateway-name", host: "host", port: 1234, group: 1, node: 1, debugmode: true },
        { id: "n1", type: "temp-input", name: "temperature-name", gateway: "g1", group: 7, node: 30, wires: [["input.helper"]] },
        { id: "input.helper", type: "input-helper", name: "input-helper-name" },
    ];

    it('temp should be loaded', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const n1 = helper.getNode("n1");
            try {
                n1.should.have.property('name', 'temperature-name');
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('input-helper should be loaded', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.should.have.property('name', 'input-helper-name');
                done();
            } catch (err) {
                done(err);
            }
        });
    });

    it('temperature values Dallas min/max (-55, +125, 0.0625)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0xFC,
                    0x90,
                    0x07,
                    0xD0,
                    0x00,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, -55);
                        assert.equal(msg.payload.setpoint, 125);
                        assert.equal(msg.payload.hysteresis, 0.0625);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('temperature values Dallas max/min (125, -55, 16)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0x07,
                    0xD0,
                    0xFC,
                    0x90,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, 125);
                        assert.equal(msg.payload.setpoint, -55);
                        assert.equal(msg.payload.hysteresis, 16);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('temperature values Dallas max+1/min-1 (126, -56, 16)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0x07,
                    0xE0,
                    0xFC,
                    0x80,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, 126);
                        assert.equal(msg.payload.setpoint, -56);
                        assert.equal(msg.payload.hysteresis, 16);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('temperature values max/min (2047.9375, -2048, 16)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0x7F,
                    0xFF,
                    0x80,
                    0x00,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, 2047.9375);
                        assert.equal(msg.payload.setpoint, -2048);
                        assert.equal(msg.payload.hysteresis, 16);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('temperature values min/max (-2048, 2047.9375, 16)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0x80,
                    0x00,
                    0x7F,
                    0xFF,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, -2048);
                        assert.equal(msg.payload.setpoint, 2047.9375);
                        assert.equal(msg.payload.hysteresis, 16);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('temperature values 1/-1 (0.0625, -0.0625, 16)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0x00,
                    0x01,
                    0xFF,
                    0xFF,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, 0.0625);
                        assert.equal(msg.payload.setpoint, -0.0625);
                        assert.equal(msg.payload.hysteresis, 16);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('temperature values -1/10 (-0.0625, 0.625, 16)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0xFF,
                    0xFF,
                    0x00,
                    0x0A,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, -0.0625);
                        assert.equal(msg.payload.setpoint, 0.625);
                        assert.equal(msg.payload.hysteresis, 16);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('temperature values room (22.875, 24.3125, 1)', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const frame =
                [
                    0xAA,
                    0x30,
                    0x40,
                    30,
                    7,
                    0xFF,
                    0xFF,
                    0x11,
                    0x01,
                    0x6E,
                    0x01,
                    0x85,
                    0x0F,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const n1 = helper.getNode("n1");
            const inputHelper = helper.getNode("input.helper");
            try {
                inputHelper.on('input', function (msg) {
                    try {
                        assert.equal(msg.payload.frameType, 0x304);
                        assert.equal(msg.payload.isAnswer, false);
                        assert.equal(msg.payload.node, 30);
                        assert.equal(msg.payload.group, 7);
                        assert.equal(msg.payload.type, 0x11);
                        assert.equal(msg.payload.temp, 22.875);
                        assert.equal(msg.payload.setpoint, 24.3125);
                        assert.equal(msg.payload.hysteresis, 1);
                        done();
                    }
                    catch (err) {
                        console.log(msg);
                        done(err);
                    }
                });
                g1.messageReceived(frame);
            }
            catch (err) {
                done(err);
            }
        });
    });
});