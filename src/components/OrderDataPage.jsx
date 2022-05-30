import { useAppBridge } from "@shopify/app-bridge-react";
import { useState, useEffect } from "react";

import { DataTable, Page, Card } from "@shopify/polaris"

import { userLoggedInFetch } from "../App";

export function OrderDataComponent(){
    // const sampleProductData = [[-111,"test-product",234.12]];
    const [ orderData, setOrderData ] = useState([]);
    const app = useAppBridge();
    const fetch = userLoggedInFetch(app);
    async function updateOrderData() {
        // console.log("Entered Update OrderData");
        const productList = await fetch("/api/product-list").then((res) => res.json());
        console.log("products\n");
        console.log(productList);

        const orderList = await fetch("/api/orders").then((res) => res.json());
        console.log("orders\n");
        console.log(orderList);

        // const options = {
        //     method:"POST",
        //     headers: {
        //         'Accept': 'application/json, text/plain, */*',
        //         'Content-Type': 'application/json'
        //       },
        //     body: JSON.stringify({ ids:[4399171600558, 4399167111342, 4399146041518] })
        // }
        // let ids = [4399171600558, 4399167111342, 4399146041518];
        // const URI = `/api/orders/?ids=${ids.join(',')}`;
        // const orderIDList = await fetch(URI).then((res) => res.json());
        // console.log("orders\n");
        // console.log(orderIDList);

        const orderData = orderList.map(order=> [ order.order_number, (new Date(order.processed_at)).toLocaleString(), order.total_price ] );
        setOrderData(orderData);        
    }

    useEffect(() => {
        updateOrderData();
    }, []);

    return(
        <Page title = "OrderData">
            <Card>
                <DataTable
                    columnContentTypes={[                        
                        'text',
                        'text',
                        'numeric'
                        
                    ]}
                    headings={[
                        'Order number',
                        'Processed at',
                        'Total Price'
                        
                    ]}
                    rows={orderData}
                />
            </Card>            
        </Page>
    )
}