import dotenv from "dotenv";
import mongoose from "mongoose";
dotenv.config();


export const dbConnection = async () => {
  try {
    const connectionString = process.env.DB_URL;
    console.log(connectionString, '::: --- DataBase connection string ---');

    await mongoose.connect(connectionString);

    console.log(`--- Connected to MongoDB (${process.env.NODE_ENV}) Successfully ---`);
  } catch (error) {
    console.error(error, `--- MongoDB Connection Failed (${process.env.NODE_ENV}) ---`);
  }
};
dbConnection();
export default dbConnection;