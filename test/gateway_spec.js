const sinon = require('sinon');
const { assert } = require("chai");
const helper = require("node-red-node-test-helper");
const gatewayNode = require("../hapcan-gateway.js");

const hapcanNodes = [gatewayNode];

helper.init(require.resolve('node-red'));

describe('HAPCAN Gateway Node', function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload();
        helper.stopServer(done);
    });

    const flow = [
        { id: "g1", type: "hapcan-gateway", name: "gateway-name", host: "host", port: 1234, group: 1, node: 1, debugmode: true },
    ];

    it('should be loaded', function (done) {
        helper.load(hapcanNodes, flow, function () {
            const g1 = helper.getNode("g1");
            try {
                g1.should.have.property('name', 'gateway-name');
                assert.isNotNull(g1.eventEmitter);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should invoke the callback', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const g1 = helper.getNode("g1");
            const emitter = g1.eventEmitter;
            try {
                emitter.on('foo', spy);
                assert(spy.notCalled);
                emitter.emit('foo');
                assert(spy.calledOnce);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should pass arguments to the callbacks', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const g1 = helper.getNode("g1");
            const emitter = g1.eventEmitter;
            try {
                emitter.on('foo', spy);
                assert(spy.notCalled);
                emitter.emit('foo', 'bar', 'baz');
                assert(spy.calledOnce);
                assert(spy.withArgs('bar', 'baz').calledOnce);
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('messageToString', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const frame = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            const g1 = helper.getNode("g1");
            try {
                const msgText = g1.messageToString(frame);
                assert.equal(msgText, ' 01 02 03 04 05 06 07 08 09 0A 0B 0C 0D 0E 0F');
                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should emit messageReceived event', function (done) {
        const spy = sinon.spy();
        helper.load(hapcanNodes, flow, function () {
            const frame = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
            const g1 = helper.getNode("g1");
            const emitter = g1.eventEmitter;
            try {
                emitter.on('messageReceived', spy);
                assert(spy.notCalled);

                g1.messageReceived(frame);
                assert(spy.calledOnce);

                done();
            }
            catch (err) {
                done(err);
            }
        });
    });

    it('should emit messageReceived_304 event', function (done) {
        const spy = sinon.spy();
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
                    0xF8,
                    0x10,
                    0xFF,
                    0xFF,
                    0xFF,
                    0xA9,
                    0xA5
                ];
            const g1 = helper.getNode("g1");
            const emitter = g1.eventEmitter;
            try {
                emitter.on('messageReceived_304', spy);
                assert(spy.notCalled);

                g1.messageReceived(frame);
                assert(spy.calledOnce);

                done();
            }
            catch (err) {
                done(err);
            }
        });
    });


});
