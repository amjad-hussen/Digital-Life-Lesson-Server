const express = require('express')
const cors = require('cors');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


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
            const { privacy } = req.body;
            const query = { _id: new ObjectId(id) }
            const updatedDoc = {
                $set: { privacy }
            }

            const result = await lessonCollection.updateOne(query, updatedDoc)
            res.send(result)
        })

        app.delete('/lessons/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)}
            const result = await lessonCollection.deleteOne(query)
            res.send(result)
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
