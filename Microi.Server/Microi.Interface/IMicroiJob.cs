using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public interface IMicroiJob
    {
        Task InitializeAsync(string connectionString);

        Task<MicroiJobResult> GetAllJob(MicroiSearchJobModel jobModel);

        Task<MicroiJobResult> GetJobByName(List<string> jobNameArr);

        Task<MicroiJobResult> AddJob(MicroiAddJobModel addJobModel);

        Task<MicroiJobResult> PauseJob(MicroiJobModel job);

        Task<MicroiJobResult> ResumeJob(MicroiJobModel job);

        Task<MicroiJobResult> DeleteJob(MicroiJobModel job);

        //Task<JobResult> StartJob(JobModel job);

        //Task<JobResult> AddTrigger(AddTriggerModel triggerDataModel);

        Task<MicroiJobResult> GetJobDetail(MicroiSearchJobModel jobModel);

        Task<MicroiJobResult> UpdateJob(MicroiAddJobModel addJobModel);

        void SyncTaskTime();

    }
}
