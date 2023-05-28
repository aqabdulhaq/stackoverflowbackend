import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SessionsClient } from '@google-cloud/dialogflow';
import { v4 as uuidv4 } from 'uuid';
import nodemailer from 'nodemailer';

dotenv.config();

const app = express();
app.use(express.json({ limit: '30mb', extended: true }));
app.use(express.urlencoded({ limit: '30mb', extended: true }));
app.use(cors());

app.get('/', (req, res) => {
  res.send('Hello, welcome to the server!');
});

// Dialogflow integration
const projectId = process.env.PROJECT_ID;
const sessionClient = new SessionsClient({
  keyFilename: process.env.SERVICE_KEY,
});

// Nodemailer setup
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.sendinblue.com',
  port: 587,
  auth: {
    user: process.env.SMTP_USERNAME,
    pass: process.env.SMTP_PASSWORD_OR_API_KEY,
  },
});

// JavaScript Map to store OTPs for verification
const otpMap = new Map();

// Function to generate OTP (customize this based on your OTP generation logic)
function generateOTP() {
  // Generate a random OTP using your preferred logic
  const otp = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return otp;
}

// Function to send OTP email
function sendOTPEmail(recipient, otp) {
  const mailOptions = {
    from: process.env.SENDER_EMAIL_ADDRESS,
    to: recipient,
    subject: 'OTP Verification',
    text: `Your OTP: ${otp}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log('Error sending email:', error);
    } else {
      console.log('Email sent:', info.response);
    }
  });
}

// Route to handle OTP request
app.post('/api/send-otp', (req, res) => {
  const { email } = req.body;

  // Validate input
  if (!email) {
    return res.status(400).json({ error: 'Email is required for OTP verification.' });
  }

  // Generate OTP
  const otp = generateOTP(); // Implement your OTP generation logic

  // Store the OTP in the map
  otpMap.set(email, otp);

  // Send OTP email
  sendOTPEmail(email, otp);

  // You can customize the response as per your requirements
  res.json({ message: 'OTP sent successfully.' });
});

// Route to handle OTP verification
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  // Check if email and OTP are provided
  if (!email || !otp) {
    return res.status(400).json({ error: 'Email and OTP are required for verification.' });
  }

  // Retrieve the stored OTP for the email from the map
  const storedOTP = otpMap.get(email);

  if (!storedOTP) {
    return res.status(400).json({ error: 'OTP not found for the provided email.' });
  }

  // Compare the provided OTP with the stored OTP
  if (otp === storedOTP) {
    // OTP verification successful
    otpMap.delete(email); // Remove the OTP from the map after successful verification

    // Proceed with your desired logic or actions
    // For example, you can authenticate the user, generate a session, etc.

    return res.json({ message: 'OTP verification successful.' });
  } else {
    // Invalid OTP
    return res.status(400).json({ error: 'Invalid OTP.' });
  }
});

// Route to handle user queries and interact with Dialogflow
app.post('/api/chatbot', async (req, res) => {
  const { query } = req.body;

  // Create a new session ID for each user query
  const sessionId = uuidv4();

  try {
    // Create a session path
    const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

    // The text query request
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: query,
          languageCode: 'en-US',
        },
      },
    };

    // Send the query to Dialogflow and receive the response
    const responses = await sessionClient.detectIntent(request);
    const result = responses[0].queryResult;

    // Return the response from Dialogflow to the client
    res.json({ response: result.fulfillmentText });
  } catch (error) {
    console.error('Error sending user query:', error);
    res.status(500).json({ error: 'An error occurred while processing the user query.' });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
