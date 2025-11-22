import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { nanoid } from "nanoid"
import pkg from "pg";

dotenv.config();
const { Pool } = pkg;

const app = express();
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://tinylink-frontend-lhws.onrender.com"
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

app.get("/verifyAPI", (req, res) => {
    res.json("API is working");
});


// Api for Dashboard
app.get("/links", async (req, res) => {
    try {
        const result = await pool.query(
            "select * from links order by created_at desc"
        );
        // console.log(result.rows);
        res.status(200).json({
            message: 'Data retrived successfully',
            statusCode: 200,
            data: result.rows
        });
    } catch (error) {
        res.status(500).json({
            error_msg: error.message,
            message: 'Somthing went wrong!',
            statusCode: 500
        })
    }
});


// Api for Add new url
app.post("/addUrl", async (req, res) => {
    try {
        const { title, original_url, code } = req.body;

        if (!original_url) {
            return res.status(400).json({
                message: 'Parameter "original_url" is missing',
                data: null,
                statusCode: 400
            });
        }

        if (!title) {
            return res.status(400).json({
                message: 'Parameter "title" is missing',
                data: null,
                statusCode: 400
            });
        }
        console.log(code);

        let short_code = code && code.trim() !== "" ? code : nanoid(8);

        const existing = await pool.query(
            "SELECT id FROM links WHERE code = $1",
            [short_code]
        );

        if (existing.rows.length > 0) {
            return res.status(409).json({
                message: "Code already exists. Try another.",
                data: null,
                statusCode: 409
            });
        }

        const short_url = `${req.protocol}://${req.get("host")}/${short_code}`;

        const result = await pool.query(
            `INSERT INTO links (code, original_url, short_url, title)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
            [short_code, original_url, short_url, title]
        );

        res.status(201).json({
            message: "Link added successfully",
            data: result.rows[0],
            statusCode: 201
        });

    } catch (error) {
        res.status(500).json({
            error_msg: error.message,
            message: 'Something went wrong!',
            statusCode: 500
        });
    }
});

// redirect to link
app.get("/redirect/:code", async (req, res) => {
    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({
                message: 'Parameter "code" is missing',
                statusCode: 400,
                data : null
            });
        }

        const result = await pool.query(
            `SELECT id, code, original_url FROM links WHERE code = $1`,
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Short code not found in DB",
                statusCode: 404,
                data : null
            });
        }

        const link = result.rows[0];

        const updated = await pool.query(
            `UPDATE links 
             SET total_clicks = total_clicks + 1, last_clicked = NOW() 
             WHERE id = $1 AND code = $2 
             RETURNING *`,
            [link.id, link.code]
        );

        if (updated.rows.length === 0) {
            return res.status(400).json({
                message: "Failed to update click count",
                statusCode: 400,
                data : null
            });
        }

        return res.redirect(link.original_url);

    } catch (error) {
        return res.status(500).json({
            error_msg: error.message,
            message: "Something went wrong!",
            statusCode: 500
        });
    }
});


// Api for get stats for one url
app.get("/code/:code", async (req, res) => {
    try {

        const { code } = req.params;

        if (!code) {
            return res.status(400).json({
                message: 'Parameter "code" is missing',
                statusCode: 400,
                data:null
            });
        }

        const result = await pool.query(
            `SELECT * FROM links WHERE code = $1`,
            [code]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                message: "Short code not found in DB",
                statusCode: 404,
                data:null
            });
        } else {
            res.status(200).json({
                message: 'Data retrived successfully',
                statusCode: 200,
                data: result.rows
            });
        }

    } catch (error) {
        return res.status(500).json({
            error_msg: error.message,
            message: "Something went wrong!",
            statusCode: 500
        });
    }
});


// Api for delete the one url detail
app.get("/remove_url/:code",async(req,res)=>{
    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({
                message: 'Parameter "code" is missing',
                statusCode: 400,
                data:null
            });
        }

        const remove_url_details = await pool.query(
            `delete from links where code = $1`,
            [code]
        );

        if(remove_url_details.rowCount > 0){
            return res.status(200).json({
                message: "URL data removed successfully",
                statusCode: 200,
                data : null
            });
        }else{
            return res.status(400).json({
                message: "Failed to delete the details",
                statusCode: 400,
                data : null
            });
        }

    } catch (error) {
        return res.status(500).json({
            error_msg: error.message,
            message: "Something went wrong!",
            statusCode: 500
        });
    }
});


// Api for health Check
app.get("/healthz", async (req, res) => {
    try {
        const dbCheck = await pool.query("SELECT NOW()");

        res.status(200).json({
            status: "ok",
            version : "1.0",
            database: "connected",
            server_time: new Date().toISOString(),
            uptime: process.uptime()
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            database: "disconnected",
            message: error.message
        });
    }
});


const PORT = process.env.PORT || 4324;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`TinyLink Backend is working on port - ${PORT}`)
});
