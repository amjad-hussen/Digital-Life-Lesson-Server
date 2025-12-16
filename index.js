const express = require('express')
const cors = require('cors');
const app = express();
require('dotenv').config()
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const admin = require("firebase-admin");

const serviceAccount = require(process.env.FIREBASE_ADMINSDK);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



// middleware
app.use(cors())
app.use(express.json())



const verifyFBToken = async (req, res, next) => {

    console.log('headers in the middleware', req.headers.authorization)
    const token = req.headers.authorization;

    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }

    try {
        const idToken = token.split(' ')[1];
        const decoded = await admin.auth().verifyIdToken(idToken)
        console.log('decoded in the token ', decoded)
        req.decoded_email = decoded.email
        next()
    }
    catch (error) {
        return res.status(401).send({ messsage: 'unauthorized access' })

    }



}


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
        const userCollection = db.collection('users')
        const reportCollection = db.collection('reports')
        const commentCollection = db.collection('comments')
        const favoriteCollection = db.collection('favorites');



        // User Relate Apis

        app.get('/users', verifyFBToken, async (req, res) => {
            const cursor = userCollection.find()
            const result = await cursor.toArray()
            res.send(result )
        })

        app.get('/users', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([]);
            }
            const result = await userCollection.findOne({ email });
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            user.role = 'user'
            user.isPremium = false
            user.createdAt = new Date()
            const email = user.email

            const userExist = await userCollection.findOne({ email })
            if (userExist) {
                return res.send({ message: 'User Already Exist' })
            }

            const result = await userCollection.insertOne(user)
            res.send(result)
        })

        app.patch('/users/:id', async(req, res) => {
            const id  = req.params.id;
            const roleInfo = req.body;
            const query = {_id: new ObjectId(id)}
            const updatedDoc = {
                $set: {
                    role:roleInfo.role
                }
            }
            const result = await userCollection.updateOne(query, updatedDoc)
            res.send(result)
        } )


        app.patch('/users/:email', async (req, res) => {
            const email = req.params.email
            const updatedData = req.body

            const query = { email: email }
            const updateDoc = {
                $set: updatedData
            }
            const result = await userCollection.updateOne(query, updateDoc)

            if (result.matchedCount === 0) {
                return res.status(404).send({ message: 'User not found' })
            }

            res.send({ message: 'User updated successfully', result })

        })


        app.patch('/users/premium', async (req, res) => {
            const email = req.body.email;

            const query = { email: email };
            const updatedDoc = {
                $set: {
                    isPremium: true
                }
            };

            const result = await userCollection.updateOne(query, updatedDoc);
            res.send(result);
        });


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

        app.patch('/lessons/:id', verifyFBToken, async (req, res) => {
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

        app.get('/lessons/recommended', async (req, res) => {
            const { category, emotionalTone, excludeId, limit } = req.query;

            let orConditions = [];
            if (category) orConditions.push({ category });
            if (emotionalTone) orConditions.push({ emotionalTone });

            let query = {};
            if (orConditions.length > 0) query.$or = orConditions;

            if (excludeId && ObjectId.isValid(excludeId)) {
                query._id = { $ne: new ObjectId(excludeId) };
            }

            const lessons = await lessonCollection.find(query).toArray();
            res.send(lessons.slice(0, parseInt(limit) || 6));
        });

        app.get('/lessons/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await lessonCollection.findOne(query)
            res.send(result)
        })

        // Toggle Like 
        app.patch('/lessons/:id/like', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const userEmail = req.decoded_email;
            const query = { _id: new ObjectId(id) }

            const lesson = await lessonCollection.findOne(query);
            if (!lesson) {
                return res.status(404).send({ message: 'Lesson not found' });
            }

            let updatedLikes = lesson.likes || [];
            let updatedReactionsCount = lesson.reactionsCount || 0;

            if (updatedLikes.includes(userEmail)) {

                updatedLikes = updatedLikes.filter(email => email !== userEmail);
                updatedReactionsCount = Math.max(0, updatedReactionsCount - 1);
            } else {

                updatedLikes.push(userEmail);
                updatedReactionsCount += 1;
            }

            const updatedDoc = {
                $set: {
                    likes: updatedLikes,
                    reactionsCount: updatedReactionsCount
                }
            };

            const result = await lessonCollection.updateOne(query, updatedDoc);
            res.send({ success: true, likes: updatedLikes, reactionsCount: updatedReactionsCount });
        })

        // Saves Count
        app.get('/favorite', verifyFBToken, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                return res.send([]);
            }

            const result = await favoriteCollection.find({ userEmail: email }).toArray();

            res.send(result);
        });

        app.patch('/lessons/:id/favorite', verifyFBToken, async (req, res) => {
            const id = req.params.id;
            const userEmail = req.decoded_email;;

            if (!userEmail) {
                return res.status(401).send({ success: false, message: 'Unauthorized' });
            }

            const query = { _id: new ObjectId(id) }

            const lesson = await lessonCollection.findOne(query);

            if (!lesson) {
                return res.status(404).send({ success: false });
            }
            const savesArray = lesson.saves || [];
            const alreadySaved = lesson.saves?.includes(userEmail);

            let updateDoc;

            if (alreadySaved) {
                updateDoc = {
                    $pull: { saves: userEmail },
                    $inc: { savesCount: -1 }
                };
                await favoriteCollection.deleteOne({
                    lessonId: new ObjectId(id),
                    userEmail: userEmail
                });
            } else {
                updateDoc = {
                    $addToSet: { saves: userEmail },
                    $inc: { savesCount: 1 }
                };
                await favoriteCollection.insertOne({
                    lessonId: new ObjectId(id),
                    userEmail: userEmail,
                    lessonTitle: lesson.lessonTitle,
                    emotionalTone: lesson.emotionalTone,
                    category: lesson.category,
                    description: lesson.description,
                    savedAt: new Date()
                });
            }

            await lessonCollection.updateOne(query, updateDoc);

            const updatedLesson = await lessonCollection.findOne(query);

            res.send({
                success: true,
                saves: updatedLesson.saves,
                savesCount: updatedLesson.savesCount
            });
        });

        app.delete('/favorite/:id', async (req, res) => {
            const { id } = req.params;
            const query = { _id: new ObjectId(id) }
            const result = await favoriteCollection.deleteOne(query);
            res.send(result);
        });










        // Report Related Apis
        app.post('/report', async (req, res) => {
            const report = req.body;
            const result = await reportCollection.insertOne(report)
            res.send(result)
        })


        // Comments Collections

        app.post('/lessons/:id/comment', verifyFBToken, async (req, res) => {
            const lessonId = req.params.id;
            const userEmail = req.decoded_email;
            const { text, userName } = req.body;

            if (!userEmail) {
                return res.status(401).send({ success: false });
            }

            const comment = {
                lessonId,
                userEmail,
                userName,
                text,
                createdAt: new Date()
            };

            const result = await commentCollection.insertOne(comment);
            res.send(result);
        });


        app.get('/lessons/:id/comments', async (req, res) => {
            const lessonId = req.params.id;
            const cursor = commentCollection.find({ lessonId }).sort({ createdAt: -1 })
            const result = await cursor.toArray()
            res.send(result);
        });



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

        app.patch('/verify-payment-success', async (req, res) => {
            const sessionId = req.query.session_id;

            const session = await stripe.checkout.sessions.retrieve(sessionId)

            if (session.payment_status === 'paid') {
                const userEmail = session.metadata.userEmail
                const query = { email: userEmail };
                const updatedDoc = {
                    $set: {
                        isPremium: true
                    }
                }
                const result = await userCollection.updateOne(query, updatedDoc)
                return res.send(result)
            }
            return res.send({ success: false })
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
