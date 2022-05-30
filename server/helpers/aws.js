const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");

module.exports.SendMessageCommand = SendMessageCommand;

const config = {
    credentials:{
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    },
    region: process.env.region
}
module.exports.sqsClient = new SQSClient(config);

