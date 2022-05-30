const { MongoClient, ServerApiVersion }= require("mongodb");

const DB_URI = process.env.MONGO_URI;
const databaseClient = new MongoClient(DB_URI,{
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
});

module.exports.getDbClient = async function(){
  try{
    await databaseClient.connect();
    return databaseClient;
  }
  catch(err){
    console.log(err);
  }
}


module.exports.persistToken = async function(dbClient, shop, token){
    try{
        // await dbClient.connect();
        let shopCollection = dbClient.db("shopify-orders").collection("shops");
        const query = { shop: shop };
        const update = { $set: { shop:shop, access_token:token }};
        const options = { upsert: true };
        await shopCollection.updateOne(query, update, options);
    }
    catch(err){
        console.log(err);
      }
      // finally{
      //   await dbClient.close();
      // }
}

module.exports.getShopTokens = async function(dbClient, shop = null){
    try{
        // await dbClient.connect();
        let shopCollection = dbClient.db("shopify-orders").collection("shops");        
        if(!shop){
            const cursor = shopCollection.find();
            const shopTokens = {};
            await cursor.forEach(doc => shopTokens[doc.shop] = doc.access_token);
            return shopTokens;
        }
        else{        
            const doc = await shopCollection.findOne({shop: shop});
            return doc.access_token;
        }
    }
    catch(err){
        console.log(err);
      }
    // finally{
    //     await dbClient.close();
    // }
}

module.exports.deleteToken = async function(dbClient, shop){
    try{
        // await dbClient.connect();
        let shopCollection = dbClient.db("shopify-orders").collection("shops");        
              
        await shopCollection.deleteOne({shop: shop});
        return true;
    }
    catch(err){
        console.log(err);
      }
      // finally{
      //   await dbClient.close();
      // }
}

module.exports.saveWebhookOrder = async function(dbClient, orderDocument){
    try{
        // await dbClient.connect();
        const db = dbClient.db('shopify-orders');
        const orderCollection = db.collection('orders');

        const query = { id: orderDocument.id };
        const update = { $setOnInsert: orderDocument};
        const options = { upsert: true };
        
        await orderCollection.insertOne(orderDocument);
      }
    catch(err){
        console.log(err);
      }
      // finally{
      //   await dbClient.close();
      // }
}

module.exports.getWebhookOrders = async function(dbClient, shop){
    try{
        // await dbClient.connect();
        const db = dbClient.db('shopify-orders');
        const orderCollection = db.collection('orders');
        
        // return await orderCollection.find().toArray();
        const orders = await orderCollection.find({shop:shop}).toArray();
        
        return orders;
      }
    catch(err){
        console.log(err);
      }
      // finally{
      //   await dbClient.close();
      // }
}