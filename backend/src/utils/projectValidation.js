function validProjectUrl(value) {
  if (!value) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return process.env.NODE_ENV === 'production'
      ? url.protocol === 'https:'
      : url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function validateProjectInput(body) {
  const fields = ['title', 'tagline', 'category', 'summary', 'overview'];
  const values = {};
  for (const field of fields) {
    if (typeof body[field] !== 'string' || !body[field].trim()) {
      return { error: 'Please complete the required project details.' };
    }
    values[field] = body[field].trim();
  }

  if (
    values.title.length > 150 ||
    values.tagline.length > 220 ||
    values.category.length > 80 ||
    values.summary.length > 5000 ||
    values.overview.length > 20000
  ) {
    return { error: 'One or more project fields exceed the allowed length.' };
  }

  const techStack = body.techStack === undefined ? [] : body.techStack;
  if (
    !Array.isArray(techStack) ||
    techStack.length > 30 ||
    techStack.some((item) => typeof item !== 'string' || item.trim().length > 40)
  ) {
    return { error: 'Tech stack must contain up to 30 short text values.' };
  }

  const urls = {};
  for (const field of ['repoUrl', 'liveUrl', 'screenshotUrl']) {
    const value = body[field] || '';
    if (!validProjectUrl(value)) {
      return { error: 'Project links must be valid HTTP or HTTPS URLs.' };
    }
    urls[field] = value || null;
  }

  return {
    data: {
      ...values,
      techStack: techStack.map((item) => item.trim()).filter(Boolean),
      ...urls,
    },
  };
}
