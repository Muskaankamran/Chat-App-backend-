import userModel from "../models/users.model.js";
import bcrypt from "bcryptjs";
import {
    clearAuthCookie,
    createAuthToken,
    serializePublicUser,
    setAuthCookie,
} from "../utils/auth.utils.js";

function isValidCredentials(username, email, password) {
    return (
        [username, email].some(
            (identifier) =>
                typeof identifier === "string" && identifier.trim().length > 0,
        ) &&
        typeof password === "string" &&
        password.length > 0
    );
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function registerUser(req, res) {
    try {
        const { username, email, password } = req.body ?? {};
        const normalizedUsername =
            typeof username === "string" ? username.trim() : "";
        const normalizedEmail =
            typeof email === "string" ? email.trim().toLowerCase() : "";

        if (
            normalizedUsername.length < 2 ||
            normalizedUsername.length > 32 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) ||
            typeof password !== "string" ||
            password.length < 8 ||
            password.length > 128
        ) {
            return res.status(400).json({
                message:
                    "Provide a valid username, email, and password (8-128 characters).",
            });
        }

        const userAlreadyExists = await userModel.findOne({
            $or: [
                { username: normalizedUsername },
                {
                    email: {
                        $regex: `^${escapeRegex(normalizedEmail)}$`,
                        $options: "i",
                    },
                },
            ],
        });

        if (userAlreadyExists) {
            return res.status(409).json({
                message: "User Already Exists",
            });
        }

        const hash = await bcrypt.hash(password, 10);
        const user = await userModel.create({
            username: normalizedUsername,
            email: normalizedEmail,
            password: hash,
        });
        const token = createAuthToken(user);
        setAuthCookie(res, token);

        return res.status(201).json({
            message: "User created successfully",
            user: serializePublicUser(user),
        });
    } catch (error) {
        console.error(error);
        if (error?.code === 11000) {
            return res.status(409).json({ message: "User Already Exists" });
        }
        return res.status(500).json({ message: "Internal server error" });
    }
}

async function loginUser(req, res) {
    try {
        const { username, email, password } = req.body ?? {};
        if (!isValidCredentials(username, email, password)) {
            return res.status(400).json({
                message: "Provide a username or email and password.",
            });
        }

        const identifiers = [username, email]
            .filter((value) => typeof value === "string" && value.trim())
            .map((value) => value.trim());
        const user = await userModel.findOne({
            $or: identifiers.flatMap((identifier) => [
                { username: identifier },
                {
                    email: {
                        $regex: `^${escapeRegex(identifier)}$`,
                        $options: "i",
                    },
                },
            ]),
        });

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({
                message: "Invalid username/email or password.",
            });
        }

        const token = createAuthToken(user);
        setAuthCookie(res, token);

        return res.status(200).json({
            message: "User logged in successfully",
            user: serializePublicUser(user),
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

function logoutUser(_req, res) {
    clearAuthCookie(res);
    return res.status(200).json({ message: "Logged out successfully." });
}

export { registerUser, loginUser, logoutUser };