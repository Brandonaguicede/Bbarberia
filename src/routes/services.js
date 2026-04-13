const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/servicesController");
const { requireAdmin } = require("../middleware/auth");

router.get("/", ctrl.getAll);
router.get("/all", requireAdmin, ctrl.getAllIncludingInactive);
router.get("/:id", ctrl.getById);
router.post("/", requireAdmin, ctrl.create);
router.put("/:id", requireAdmin, ctrl.update);
router.delete("/:id", requireAdmin, ctrl.remove);

module.exports = router;
