const moment = require("moment");
const { SQSClient, SendMessageCommand } = require("@aws-sdk/client-sqs");
const {
    EventBridgeClient,
    PutRuleCommand,
    PutTargetsCommand,
    ListRulesCommand,
    ListRuleNamesByTargetCommand,
    DeleteRuleCommand
} = require("@aws-sdk/client-eventbridge");
const {
    S3Client,
    ListBucketsCommand,
    PutObjectCommand,
    GetObjectCommand,
    ListObjectsCommand,
    CreateBucketCommand,
    DeleteBucketCommand, 
    DeleteObjectCommand} = require("@aws-sdk/client-s3");

const { createReadStream } = require("fs");
const { basename } = require("path");
const { Key } = require("@shopify/polaris");



const config = {
    credentials: {
        accessKeyId: process.env.ACCESS_KEY_ID,
        secretAccessKey: process.env.SECRET_ACCESS_KEY
    },
    region: process.env.REGION
}

const sqsClient = new SQSClient(config);
const ebClient = new EventBridgeClient(config);
const s3Client = new S3Client(config);


// module.exports.ebClient = ebClient;

async function setupOrderWebhookTallyJob(shop) {
    const putRuleCommand = new PutRuleCommand({
        Name: `orderWebhookTally-${shop}`,
        ScheduleExpression: "cron(0 * * * ? *)",
        State: "ENABLED"
    });

    const putTargetsCommand = new PutTargetsCommand({
        Rule: `orderWebhookTally-${shop}`,
        Targets: [
            {
                Id: "webhookTallyAPI",
                Arn: process.env.AWS_WBHK_TLY_API_ARN,
                Input: JSON.stringify({ shop })
            }
        ]
    });

    const listRulescommand = new ListRulesCommand({});

    try {
        const response = await ebClient.send(listRulescommand);
        if (!response || response.Rules === undefined) {
            throw new Error("AWS List rules call returned empty");
        }
        const ruleNames = response.Rules.map(rule => rule.Name);
        if (ruleNames.includes(`orderWebhookTally-${shop}`)) {
            return;
        }

        const data1 = await ebClient.send(putRuleCommand);
        
        if (!data1['$metadata'].httpStatusCode == 200) {
            throw new Error("Failed to Write AWS EB Rule");
        }
        console.log("Webhook tally scheduler rule created on AWS");

        const data2 = await ebClient.send(putTargetsCommand);
        if (!data2['$metadata'].httpStatusCode == 200) {
            throw new Error("Failed to Write Targets to AWS EB Rule");
        }
    }
    catch (err) {
        console.log(err);
    }
}

async function setupAbandonedCheckoutPoller(shop) {
    const putRuleCommand = new PutRuleCommand({
        Name: `abandonedCheckoutPoller-${shop}`,
        ScheduleExpression: "cron(0/2 * * * ? *)",
        State: "ENABLED"
    });

    const putTargetsCommand = new PutTargetsCommand({
        Rule: `abandonedCheckoutPoller-${shop}`,
        Targets: [
            {
                Id: "ABCKP_API",
                Arn: process.env.AWS_ABND_CHKT_API_ARN,
                Input: JSON.stringify({ shop })
            }
        ]
    });

    const listRulescommand = new ListRulesCommand({});

    try {
        const response = await ebClient.send(listRulescommand);
        if (!response || response.Rules === undefined) {
            throw new Error("AWS List rules call returned empty");
        }
        const ruleNames = response.Rules.map(rule => rule.Name);
        if (ruleNames.includes(`abandonedCheckoutPoller-${shop}`)) {
            return;
        }

        const data1 = await ebClient.send(putRuleCommand);

        if (!data1['$metadata'].httpStatusCode == 200) {
            throw new Error("Failed to Write AWS EB Rule");
        }
        console.log("Abandoned checkout poll rule created on AWS");

        const data2 = await ebClient.send(putTargetsCommand);
        if (!data2['$metadata'].httpStatusCode == 200) {
            throw new Error("Failed to Write Targets to AWS EB Rule");
        }
    }
    catch (err) {
        console.log(err);
    }

}

async function deleteOrderWebhookTallyJob(shop) {
    const deleteRuleCommand = new DeleteRuleCommand({
        Name: `orderWebhookTally-${shop}`
    });

    const response = await ebClient.send(deleteRuleCommand);
    console.log("deleteOrderWebhookTallyJob Response:\n", response);
}

async function deleteAbandonedCheckoutPoller(shop) {
    const deleteRuleCommand = new DeleteRuleCommand({
        Name: `abandonedCheckoutPoller-${shop}`
    });

    const response = await ebClient.send(deleteRuleCommand);
    console.log("deleteAbandonedCheckoutPoller Response:\n", response);
}

module.exports.setupSchedulers = async function (shop) {
    await setupOrderWebhookTallyJob(shop);
    await setupAbandonedCheckoutPoller(shop);
}

module.exports.deleteSchedulers = async function (shop) {
    await deleteOrderWebhookTallyJob(shop);
    await deleteAbandonedCheckoutPoller(shop);
}

module.exports.setupAbandonedCheckoutReminder = async function (abandonedCheckout, shop) {
    const t = moment.utc().add(2, 'm'); //time to set reminder
    const cronExpression = `cron(${t.minute()} ${t.hour()} ${t.date()} ${t.month() + 1} ? ${t.year()})`;

    const timestamp = new Date().toISOString().replaceAll(":", "..");  //Aws rule name doesn't allow ":"

    const ruleName = `abCkR--${abandonedCheckout.id}--${timestamp}--1`;

    const putRuleCommand = new PutRuleCommand({
        Name: ruleName,
        ScheduleExpression: cronExpression,
        State: "ENABLED"
    });

    const putTargetsCommand = new PutTargetsCommand({
        Rule: ruleName,
        Targets: [
            {
                Id: process.env.AWS_ABND_CHKT_SQS_ID,
                Arn: process.env.AWS_ABND_CHKT_SQS_ARN,
                Input: JSON.stringify({
                    checkoutId: abandonedCheckout.id,
                    shop,
                    ruleName
                })
            }
        ]
    });

    const listRulescommand = new ListRuleNamesByTargetCommand({
        TargetArn: process.env.AWS_ABND_CHKT_SQS_ARN
    });

    try {
        const response = await ebClient.send(listRulescommand);
        if (!response || response.RuleNames === undefined) {
            throw new Error("AWS List rules call returned empty");
        }

        //Remove timestamp,etc., from rulename for comaprision as they are always unique
        const strippedRuleNames = response.RuleNames.map(rName => rName.split('-').slice(0, 2).join('-'));
        const strippedRuleName = ruleName.split('-').slice(0, 2).join('-');

        if (strippedRuleNames.includes(strippedRuleName)) {
            return;
        }

        const data1 = await ebClient.send(putRuleCommand);        
        
        if (!data1['$metadata'].httpStatusCode == 200) {
            throw new Error("Failed to Write AWS EB Rule");
        }
        console.log("Abandoned checkout Reminder rule created on AWS");

        const data2 = await ebClient.send(putTargetsCommand);
        if (!data2['$metadata'].httpStatusCode == 200) {
            throw new Error("Failed to Write Targets to AWS EB Rule");
        }
    }
    catch (err) {
        console.log(err);
    }

}

module.exports.createBucket = async function (bucketName) {
    return await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
}

async function emptyBucket(bucketName){
    try{
        const response = await s3Client.send(new ListObjectsCommand({Bucket: bucketName}));
        const bucketObjects = response.Contents;
        console.log("Bucket Objects: ",bucketObjects);
        if(bucketObjects.length > 0){
            for (let object of bucketObjects){
                await deleteBucketObject(bucketName, object.Key);
            }
        }        
    }
    catch(err){
        console.log(err);
    }
}

async function deleteBucketObject(bucketName, objectKey){
    try{
        const response = await s3Client.send(
            new DeleteObjectCommand({
              Bucket: bucketName,
              Key: objectKey,
            })
          );
    }
    catch(err){
        console.log(err);
    }
}

module.exports.deleteBucket = async function (bucketName) {
    await emptyBucket(bucketName);
    return await s3Client.send(new DeleteBucketCommand({ Bucket: bucketName }));
}

module.exports.checkBucketExists = async function (bucketName) {
    const response = await s3Client.send(new ListBucketsCommand({}));
    
    for (let bucket of response.Buckets){
        if (bucket.Name === bucketName) {            
            return true;
        }
    };
    return false;
}

module.exports.putFileInS3 = async function (bucketName, file, fileKey) {
    const uploadParams = {
        Bucket: bucketName,
        Key: fileKey || basename(file),
        Body: createReadStream(file),
    };
    const putFileCommand = new PutObjectCommand(uploadParams);

    try {
        const response = await s3Client.send(putFileCommand);
        if (!response['$metadata'].httpStatusCode == 200) {
            throw new Error("Failed to upload file: ", file, " to AWS S3");
        }
    }
    catch (err) {
        console.log(err);
    }
}

module.exports.getObject = async function(bucketName, objectKey) {
    console.log("OBJECT KEY:",objectKey);
    const data = await s3Client.send(
        new GetObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
        })
    );
    const objectStream = data.Body;
    return data;
}

module.exports.SendMessageCommand = SendMessageCommand;
module.exports.sqsClient = sqsClient;
module.exports.s3Client = s3Client;