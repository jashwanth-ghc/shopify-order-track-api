const { deleteToken, 
         saveWebhookOrder,
         getShopTokens,
         getWebhookOrders } = require("./database.js");
const { sqsClient, SendMessageCommand, deleteSchedulers } = require("./aws.js");

module.exports.addWebhookHandlers  = function(Shopify, dbClient){
    Shopify.Webhooks.Registry.addHandler("APP_UNINSTALLED", {
        path: "/webhooks",
        webhookHandler: async (topic, shop, body) => {
          // delete ACTIVE_SHOPIFY_SHOPS[shop];
          await deleteToken(dbClient, shop);
          await deleteSchedulers(shop);
        },
    });

    Shopify.Webhooks.Registry.addHandler("PRODUCTS_CREATE", {
        path: "/webhooks",
        webhookHandler: async (topic, shop, body) => { 
          body = JSON.parse(body);                               //replace with send message
          console.log(shop + "-" + body.id + "-" + body.title);  //replace with send message
        },
    });

    Shopify.Webhooks.Registry.addHandler("ORDERS_CREATE", {
        path: "/webhooks",
        webhookHandler: async (topic, shop, body) => {
          body = JSON.parse(body);
          const orderDocument = {
            id:body.id,
            order_number:body.order_number,
            shop:shop,
            processed_at:body.processed_at
          };
          await saveWebhookOrder(dbClient, orderDocument);

          // body = JSON.parse(body);            //replace with send message
          console.log(shop + "-" + body.id);  //replace with send message
          const inputParams = {
            MessageBody: JSON.stringify(orderDocument),
            QueueUrl: process.env.AWS_SQS_URL
          }
          const sendCommand = new SendMessageCommand(inputParams);
          console.log("reached end");
          try{
            const response = await sqsClient.send(sendCommand);
            console.log(response);
          }
          catch(err){
            console.log("AWS SQS error :\n", err);
          }          
        },
      });


}

module.exports.orderWebhookTally = async function(dbClient, Shopify, shop){ 
  const accessToken = await getShopTokens(dbClient, shop); 
  // for (let shop in shopTokens){
  //   const accessToken = shopTokens[shop];

  const client = new Shopify.Clients.Rest(shop, accessToken);
  const response = await client.get({
    path:'orders',
    query:{
      created_at_min: (new Date( Date.now() - 1000*60*60 )).toISOString()  // orders created since last Cronjob
    }
  });
  const ordersInShopify = response.body.orders;

  const orderIdsInShopify = ordersInShopify.map(order=>order.id);
  let ordersReceivedByWebhook = [];
  const webhookOrders = await getWebhookOrders(dbClient, shop);

  webhookOrders.forEach(order => {ordersReceivedByWebhook.push(order.id)});

  let ordersMissedByWebhook = [];

  orderIdsInShopify.forEach(orderId => {
    if( !(ordersReceivedByWebhook.includes(orderId)) ){
        ordersMissedByWebhook.push(orderId);
    }
  });
  console.log("Orders missed:\n" + ordersMissedByWebhook.join(","));  //replace with send to services
  // }
}