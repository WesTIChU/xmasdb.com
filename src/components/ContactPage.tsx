import React, { useState } from 'react';
import { CONTACT_URL, submitContact } from '../api/client';

type FormValues = {
  type: string;
  title: string;
  message: string;
  name: string;
  email: string;
  spamCheck: string;
  website: string;
};

const INITIAL_VALUES: FormValues = {
  type: '',
  title: '',
  message: '',
  name: '',
  email: '',
  spamCheck: '',
  website: '',
};

export const ContactPage: React.FC = () => {
  const [values, setValues] = useState(INITIAL_VALUES);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const updateValue = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSending) return;
    if ((values.type === 'missing-movie' || values.type === 'correction') && !values.title.trim()) {
      setError('Please add the movie or title.');
      return;
    }
    if (!values.message.trim()) {
      setError('Please add a message.');
      return;
    }

    setIsSending(true);
    setError('');
    try {
      await submitContact(values);
      setSent(true);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="py-10 sm:py-14" aria-labelledby="contact-heading">
      <div className="mx-auto max-w-2xl">
        <div className="border-b border-[#E7DFD5] pb-6">
          <h1 id="contact-heading" className="font-heading text-2xl font-semibold tracking-wide text-[#1A3D2F] sm:text-3xl">CONTACT XMASDB</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[#736B63]">Found something wrong or spotted a Christmas movie we've missed? Send it over and I'll take a look.</p>
        </div>

        {sent ? (
          <p className="border-b border-[#E7DFD5] py-8 font-body text-lg text-[#1A3D2F]" role="status">Thanks. Your message has been sent.</p>
        ) : (
          <form className="space-y-6 pt-8" onSubmit={handleSubmit} action={CONTACT_URL} noValidate>
            {error && <p className="border-l-2 border-[#841818] bg-[#F7F2EB] px-4 py-3 text-sm text-[#841818]" role="alert">{error}</p>}

            <div>
              <label htmlFor="contact-type" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">Submission type</label>
              <select id="contact-type" name="type" required value={values.type} onChange={(event) => updateValue('type', event.target.value)} className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 text-[#23211E] outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20">
                <option value="">Choose one</option>
                <option value="missing-movie">Missing movie</option>
                <option value="correction">Error or correction</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="contact-title" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">Movie / title</label>
              <input id="contact-title" name="title" type="text" maxLength={200} value={values.title} onChange={(event) => updateValue('title', event.target.value)} className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 text-[#23211E] outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20" />
            </div>

            <div>
              <label htmlFor="contact-message" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">Message</label>
              <textarea id="contact-message" name="message" required maxLength={3000} rows={7} value={values.message} onChange={(event) => updateValue('message', event.target.value)} className="w-full resize-y rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 text-[#23211E] outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20" />
            </div>

            <div>
              <label htmlFor="contact-name" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">Name <span className="font-normal text-[#736B63]">(optional)</span></label>
              <input id="contact-name" name="name" type="text" maxLength={100} value={values.name} onChange={(event) => updateValue('name', event.target.value)} className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 text-[#23211E] outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20" />
            </div>

            <div>
              <label htmlFor="contact-email" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">Email <span className="font-normal text-[#736B63]">(optional)</span></label>
              <input id="contact-email" name="email" type="email" maxLength={254} value={values.email} onChange={(event) => updateValue('email', event.target.value)} className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 text-[#23211E] outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20" />
              <p className="mt-1.5 text-xs text-[#736B63]">Only needed if you would like a reply.</p>
            </div>

            <div>
              <label htmlFor="contact-spam-check" className="mb-2 block text-sm font-semibold text-[#1A3D2F]">Spam check: How many movies are currently in XmasDB?</label>
              <input id="contact-spam-check" name="spamCheck" type="text" inputMode="numeric" required value={values.spamCheck} onChange={(event) => updateValue('spamCheck', event.target.value)} className="w-full rounded border border-[#DCD3C7] bg-[#FFFDF9] px-3 py-2.5 text-[#23211E] outline-none focus:border-[#1A3D2F] focus:ring-2 focus:ring-[#1A3D2F]/20" />
              <p className="mt-1.5 text-xs text-[#736B63]">Hint: the answer is at the top of this page.</p>
            </div>

            <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden="true">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={values.website} onChange={(event) => updateValue('website', event.target.value)} />
            </div>

            <button type="submit" disabled={isSending} className="rounded border border-[#1A3D2F] bg-[#1A3D2F] px-5 py-3 text-sm font-semibold tracking-wide text-[#FAF7F2] transition-colors hover:bg-[#143626] disabled:cursor-wait disabled:opacity-60">{isSending ? 'SENDING...' : 'SEND MESSAGE'}</button>
          </form>
        )}
      </div>
    </section>
  );
};
