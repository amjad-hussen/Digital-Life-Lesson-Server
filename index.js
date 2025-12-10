const express = require('express')
const cors = require('cors');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



// middleware
app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.4wysv8m.mongodb.net/?appName=Cluster0`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



async function run() {
    try {

        await client.connect();

        const db = client.db('digital_life_lesson_db')
        const lessonCollection = db.collection('lessons')


        // Lesson Related Apis

        app.get('/lessons', async (req, res) => {
            const query = {}

            const { email } = req.query
            if (email) {
                query.email = email
            }

            const cursor = lessonCollection.find(query)
            const result = await cursor.toArray()
            res.send(result)

        })

        app.post('/lessons', async (req, res) => {
            const lesson = req.body;
            const result = await lessonCollection.insertOne(lesson)
            res.send(result)
        })

        app.patch('/lessons/:id', async (req, res) => {
            const id = req.params.id;
            const updatedFields = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: updatedFields
            }

            const result = await lessonCollection.updateOne(query, updatedDoc)
            res.send(result)
        })



        app.delete('/lessons/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await lessonCollection.deleteOne(query)
            res.send(result)
        })


        // Payment releted apis
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = 12 * 100
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        price_data: {
                            currency: 'USD',
                            unit_amount: amount,
                            product_data: {
                                name: 'Premium Plan – Lifetime Access',
                                description: 'Unlock premium lessons, ad-free experience, and priority listing.'
                            }
                        },
                        quantity: 1,
                    },
                ],
                mode: 'payment',
                customer_email: paymentInfo.email,
                metadata: {
                    userEmail: paymentInfo.email
                },
                success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
            })
            res.send({ url: session.url })
        })


        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('Digital Life lesson is Running..!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
