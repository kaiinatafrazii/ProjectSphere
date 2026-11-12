DROP TRIGGER IF EXISTS projects_updated_at;

CREATE TRIGGER projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at AND (
  NEW.user_id IS NOT OLD.user_id OR
  NEW.title IS NOT OLD.title OR
  NEW.tagline IS NOT OLD.tagline OR
  NEW.category IS NOT OLD.category OR
  NEW.tech_stack IS NOT OLD.tech_stack OR
  NEW.summary IS NOT OLD.summary OR
  NEW.overview IS NOT OLD.overview OR
  NEW.repo_url IS NOT OLD.repo_url OR
  NEW.live_url IS NOT OLD.live_url OR
  NEW.screenshot_url IS NOT OLD.screenshot_url OR
  NEW.status IS NOT OLD.status
)
BEGIN
  UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;