require("dotenv").config();
const express = require("express");
require("./config/database")
const userRouter = require("./routes/userRouter")
const scoreRouter = require("./routes/scoreRouter")


const PORT = process.env.PORT

const app = express();

app.use(express.json())
app.use("/api/v1", userRouter)
app.use("/api/v1", scoreRouter)


app.listen(PORT, () => {
    console.log(`server is listening to port: ${PORT}`);
    
})