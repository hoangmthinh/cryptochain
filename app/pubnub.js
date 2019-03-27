const PubNubApp = require('pubnub');


const credentials = {
    publishKey: "pub-c-5fbdd510-67c6-4fb9-9236-cdd964aa335e",
    subscribeKey: "sub-c-9adb7baa-42e5-11e9-860e-caf3c7524d6c",
    secretKey: "sec-c-YTg2YzBhMTAtY2ZhZi00MWQ3LTk4MDEtMjliZTEwZGM2MmM4"
};

const CHANNELS = {
    TESTONE: "TEST-ONE",
    TESTTWO: "TEST_TWO",
    TESTTHREE: "TEST-THREE"
};

class PubNub {
    constructor() {
        this.pubnub = new PubNubApp(credentials);

        this.pubnub.subscribe({ channels: Object.values(CHANNELS) });

        this.pubnub.addListener(this.listener());
    }

    listener() {
        return {
            message: messageObject => {
                const {channel, message} = messageObject;
                console.log(`Message Received. Channel: ${channel}. Message: ${message}.`);
            }
        }
    }

    publish({channel, message}) {
        this.pubnub.publish({channel, message});
    }
}

const testPubNub = new PubNub();
testPubNub.publish({channel: CHANNELS.TESTONE, message: 'hello-pubnub'});

module.exports = PubNub;