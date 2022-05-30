const serverlessExpress = require('@vendia/serverless-express');
const {createServer} = require('./server/index');
// const {app} = await createServer();
// export const handler = serverlessExpress({ app });

// const serverlessExpress = require('@vendia/serverless-express')
// const {createServer} =  require("./server/index");

// // const {app} = await createServer();
// // exports.handler = serverlessExpress({ app });

let serverlessExpressInstance;

async function setup (event, context) {
    const {app} = await createServer();
    serverlessExpressInstance = serverlessExpress({ app })
    return serverlessExpressInstance(event, context)
  }

module.exports.handler = function(event, context){
    if (serverlessExpressInstance) return serverlessExpressInstance(event, context);

    return setup(event, context);
}

// exports.handler = handler;