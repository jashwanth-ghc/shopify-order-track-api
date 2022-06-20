require("dotenv").config();
const path = require('path');
const { build } = require('vite');
const {
    checkBucketExists,
    createBucket,
    deleteBucket,
    putFileInS3,
} = require("./aws.js");
const { getFiles } = require("./utils.js");

const bucketName = process.env.BUILD_FILES_AWS_BUCKET_UI;
const buildPath = path.resolve(__dirname,"../../dist");


async function buildFiles() {
    await build({
        root: path.resolve(__dirname, '../../'),
        base: "/staging/"
    })
}

async function putBuildFiles(bucketName, buildPath) {
    for await (let file of getFiles(buildPath)) {
        const fileKey = path.relative(buildPath, file)
        await putFileInS3(bucketName, file, fileKey);
    }
}

async function buildScript() {
    await buildFiles();
    try {
        const bucketExists = await checkBucketExists(bucketName);
        if (bucketExists) {            
           const res1 = await deleteBucket(bucketName);
        }
        const res2 = await createBucket(bucketName);
        const res3 = await putBuildFiles(bucketName, buildPath);
        return true;
    }
    catch (err) {
        console.log(err);
    }

}
buildScript().then((success, err) => { 
    success ? console.log("Build and Deploy script executed successfully") 
    : console.log("Build and Deploy script Failed") 
});
