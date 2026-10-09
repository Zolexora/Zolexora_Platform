import { Router, type IRouter } from "express";
import healthRouter from "./Health";
import whatsappRouter from "./WhatsApp";

const router: IRouter = Router();

router.use(healthRouter);
router.use(whatsappRouter);

export default router;
