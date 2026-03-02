import { Router } from 'express';
import { getState, searchJobs, getJobDetails, applyToJob, getAppliedJobs } from '../linkedin/automation';

export const jobsRouter = Router();

jobsRouter.get('/', (_req, res) => {
  const { jobs } = getState();
  res.json({ jobs });
});

jobsRouter.post('/search', async (req, res) => {
  const { keywords, location, distance, easyApply, generativeAI, experienceLevels, jobTypes, workLocations, datePosted, salaryMin, under10Applicants } = req.body || {};
  try {
    const jobs = await searchJobs(
      keywords || '',
      location,
      distance,
      easyApply,
      generativeAI,
      experienceLevels,
      jobTypes,
      workLocations,
      datePosted,
      salaryMin,
      under10Applicants
    );
    res.json({ jobs });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Job search failed';
    res.status(500).json({ error: message });
  }
});

jobsRouter.get('/applied', async (_req, res) => {
  try {
    const jobs = await getAppliedJobs();
    res.json({ jobs });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to get applied jobs';
    res.status(500).json({ error: message });
  }
});

jobsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const job = await getJobDetails(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ job });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to get job details';
    res.status(500).json({ error: message });
  }
});

jobsRouter.post('/:id/apply', async (req, res) => {
  const { id } = req.params;
  try {
    const success = await applyToJob(id);
    res.json({ ok: success, message: success ? 'Application initiated' : 'Failed to apply' });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to apply to job';
    res.status(500).json({ error: message });
  }
});
