import express from 'express';
import {
  getActivityLogs,
  exportActivityLogs,
  getSystemReports,
  generateSystemReport,
  downloadReport,
  getSystemHealth,
  getSystemMetrics,
  getSystemSettings,
  updateSystemSettings,
  clearCache,
  triggerBackup,
  testEmailConfiguration
} from '../controllers/systemAdmin';
import { authenticate, requireRole } from '../middleware/auth';

const router = express.Router();

// All routes require SYSTEM_ADMIN role
router.use(authenticate);
router.use(requireRole(['SYSTEM_ADMIN']));

// ============================================================================
// ACTIVITY LOGS ROUTES
// ============================================================================
router.get('/logs', getActivityLogs);
router.get('/logs/export', exportActivityLogs);

// ============================================================================
// SYSTEM REPORTS ROUTES
// ============================================================================
router.get('/reports', getSystemReports);
router.post('/reports/generate', generateSystemReport);
router.get('/reports/:id/download', downloadReport);

// ============================================================================
// SYSTEM HEALTH ROUTES
// ============================================================================
router.get('/health', getSystemHealth);
router.get('/metrics', getSystemMetrics);

// ============================================================================
// SYSTEM SETTINGS ROUTES
// ============================================================================
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);
router.post('/cache/clear', clearCache);
router.post('/backup', triggerBackup);
router.post('/email/test', testEmailConfiguration);

export default router;
