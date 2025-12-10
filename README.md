# BloomTrack Inventory System (MongoDB Version)

This app now uses **MongoDB** as the database.

## Prerequisites
1.  **Node.js** installed.
2.  **MongoDB** installed and running on your machine (or a connection string for Atlas).

## How to Run
1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the app:
    ```bash
    npm run dev
    ```

## Database Config
The database connection string is in the `.env` file.
Default: `mongodb://127.0.0.1:27017/flora_manager`

## VPS Deployment
1.  Set `MONGODB_URI` in your VPS environment variables (or .env file) to point to your MongoDB instance (e.g., MongoDB Atlas).
2.  Run `npm run build`.
3.  Run `npm start`.
