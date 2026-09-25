import { loginHandler } from './login.js';
import { apiMiddleware } from './middleware.js';
import { buildReport } from './report.js';

export function registerRoutes(app) {
  app.post('/login', loginHandler);
  app.use('/api', apiMiddleware);
  app.get('/api/report', (req) => ({ status: 200, body: buildReport(req.rows ?? []) }));
}
